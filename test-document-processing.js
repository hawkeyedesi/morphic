#!/usr/bin/env node

/**
 * Test script for multi-platform document processing
 * 
 * This script tests the document processing pipeline with different methods
 * to validate the implementation works correctly on the current platform.
 */

const fs = require('fs').promises;
const axios = require('axios');
const { execSync } = require('child_process');
const path = require('path');
const { createInterface } = require('readline');

// Configuration
const TEST_PDF_URL = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
const TEST_DOCUMENT_PATH = path.join(__dirname, 'test-document.pdf');
const TEMP_DIR = path.join(__dirname, 'temp-test-outputs');

// Create readline interface for user input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper to ask questions
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Main test function
 */
async function runTests() {
  try {
    console.log(`${colors.bright}${colors.blue}Multi-platform Document Processing Test${colors.reset}\n`);
    console.log(`Testing document processing on platform: ${process.platform} (${process.arch})\n`);
    
    // Detect if running on ARM64 Mac
    const isARM64Mac = process.platform === 'darwin' && process.arch === 'arm64';
    console.log(`${isARM64Mac ? '🍎 Running on Apple Silicon (ARM64)' : '💻 Running on x86_64'}\n`);

    // Check if required services are running
    await checkServices();
    
    // Download test document if needed
    await prepareTestDocument();
    
    // Create temp directory for outputs
    await ensureTempDir();
    
    // Test each method in sequence
    await testUnstructuredDockerAPI();
    await testPythonUnstructured();
    await testFallbackProcessing();
    
    // Optional: Test Docling if available
    const testDocling = await question('\nWould you like to test Docling integration? (y/n): ');
    if (testDocling.toLowerCase() === 'y') {
      await testDoclingProcessing();
    }
    
    // Summary
    console.log(`\n${colors.bright}${colors.green}Testing complete!${colors.reset}`);
    console.log(`Check the ${TEMP_DIR} directory for the test outputs.\n`);
    
    rl.close();
  } catch (error) {
    console.error(`\n${colors.red}Test failed:${colors.reset}`, error);
    rl.close();
    process.exit(1);
  }
}

/**
 * Check if required services are running
 */
async function checkServices() {
  console.log(`${colors.cyan}Checking required services...${colors.reset}`);
  
  // Check for Docker
  try {
    execSync('docker ps', { stdio: 'ignore' });
    console.log(`${colors.green}✓${colors.reset} Docker is running`);
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} Docker is not running`);
    throw new Error('Docker is required for this test.');
  }
  
  // Check Redis
  try {
    execSync('docker ps | grep redis:', { stdio: 'ignore' });
    console.log(`${colors.green}✓${colors.reset} Redis container is running`);
  } catch (error) {
    console.log(`${colors.yellow}!${colors.reset} Redis container not found, it should be started`);
  }
  
  // Check Qdrant
  try {
    execSync('docker ps | grep qdrant/qdrant:', { stdio: 'ignore' });
    console.log(`${colors.green}✓${colors.reset} Qdrant container is running`);
  } catch (error) {
    console.log(`${colors.yellow}!${colors.reset} Qdrant container not found, it should be started`);
  }
  
  // Check unstructured
  try {
    execSync('docker ps | grep unstructured:', { stdio: 'ignore' });
    console.log(`${colors.green}✓${colors.reset} Unstructured.io container is running`);
  } catch (error) {
    console.log(`${colors.yellow}!${colors.reset} Unstructured.io container not found`);
  }
  
  console.log('');
}

/**
 * Download test document if needed
 */
async function prepareTestDocument() {
  console.log(`${colors.cyan}Preparing test document...${colors.reset}`);
  
  try {
    await fs.access(TEST_DOCUMENT_PATH);
    console.log(`${colors.green}✓${colors.reset} Test document already exists`);
  } catch (error) {
    console.log(`Downloading test document from ${TEST_PDF_URL}...`);
    
    const response = await axios({
      method: 'get',
      url: TEST_PDF_URL,
      responseType: 'arraybuffer'
    });
    
    await fs.writeFile(TEST_DOCUMENT_PATH, response.data);
    console.log(`${colors.green}✓${colors.reset} Test document downloaded to ${TEST_DOCUMENT_PATH}`);
  }
  
  console.log('');
}

/**
 * Ensure temp directory exists
 */
async function ensureTempDir() {
  try {
    await fs.access(TEMP_DIR);
  } catch (error) {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  }
}

/**
 * Test unstructured.io Docker API
 */
async function testUnstructuredDockerAPI() {
  console.log(`${colors.cyan}Testing unstructured.io Docker API...${colors.reset}`);
  
  try {
    // Check if API is accessible
    try {
      await axios.get('http://localhost:8000/health');
      console.log(`${colors.green}✓${colors.reset} Unstructured.io API is accessible`);
    } catch (error) {
      console.log(`${colors.red}✗${colors.reset} Unstructured.io API is not accessible`);
      throw new Error('Unstructured.io API is not accessible');
    }
    
    // Process test document
    console.log('Processing test document...');
    
    const fileBuffer = await fs.readFile(TEST_DOCUMENT_PATH);
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('files', blob, 'test-document.pdf');
    formData.append('strategy', 'auto');
    formData.append('hi_res_pdf', 'true');
    
    try {
      formData.append('chunking_strategy', JSON.stringify({
        chunk_size: 1000,
        chunk_overlap: 200
      }));
    } catch (e) {
      formData.append('chunk_size', '1000');
      formData.append('chunk_overlap', '200');
    }
    
    const response = await axios.post('http://localhost:8000/general/v0/general', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 30000
    });
    
    const outputPath = path.join(TEMP_DIR, 'unstructured-docker-output.json');
    await fs.writeFile(outputPath, JSON.stringify(response.data, null, 2));
    
    console.log(`${colors.green}✓${colors.reset} Document processed successfully`);
    console.log(`Output saved to: ${outputPath}`);
    console.log(`Extracted ${response.data.elements ? response.data.elements.length : 'unknown'} elements`);
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} Failed to process with unstructured.io Docker API`);
    console.log(`Error: ${error.message}`);
  }
  
  console.log('');
}

/**
 * Test Python unstructured.io
 */
async function testPythonUnstructured() {
  console.log(`${colors.cyan}Testing Python unstructured.io wrapper...${colors.reset}`);
  
  // Check if Python is available
  try {
    execSync('python --version', { stdio: 'ignore' });
    console.log(`${colors.green}✓${colors.reset} Python is available`);
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} Python is not available`);
    console.log('Skipping Python unstructured.io test');
    return;
  }
  
  // Check if unstructured package is installed
  try {
    execSync('python -c "import unstructured"', { stdio: 'ignore' });
    console.log(`${colors.green}✓${colors.reset} Python unstructured package is installed`);
  } catch (error) {
    console.log(`${colors.yellow}!${colors.reset} Python unstructured package is not installed`);
    console.log('Skipping Python unstructured.io test');
    return;
  }
  
  try {
    console.log('Processing test document with Python unstructured.io...');
    
    const result = execSync(
      `python -c "
      import json
      import sys
      
      try:
          from unstructured.partition.auto import partition
          from unstructured.chunking.title import chunk_by_title
          
          elements = partition('${TEST_DOCUMENT_PATH}')
          chunks = chunk_by_title(elements, combine_text_under_n_chars=1000, overlap=200)
          
          # Convert to unstructured.io API response format
          result = [{'id': f'chunk-{i}', 'text': c.text, 'type': c.category, 
                    'metadata': {'page_number': getattr(c, 'metadata', {}).get('page_number', 1)}} 
                   for i, c in enumerate(chunks)]
          
          print(json.dumps(result))
      except Exception as e:
          print(json.dumps({'error': str(e)}), file=sys.stderr)
          sys.exit(1)
      "`, 
      { encoding: 'utf-8' }
    );
    
    const parsedResult = JSON.parse(result);
    const outputPath = path.join(TEMP_DIR, 'python-unstructured-output.json');
    await fs.writeFile(outputPath, JSON.stringify(parsedResult, null, 2));
    
    console.log(`${colors.green}✓${colors.reset} Document processed successfully with Python unstructured.io`);
    console.log(`Output saved to: ${outputPath}`);
    console.log(`Extracted ${parsedResult.length} chunks`);
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} Failed to process with Python unstructured.io`);
    console.log(`Error: ${error.message}`);
  }
  
  console.log('');
}

/**
 * Test fallback processing
 */
async function testFallbackProcessing() {
  console.log(`${colors.cyan}Testing fallback processing...${colors.reset}`);
  
  try {
    // Use pdf-parse to extract text
    console.log('Processing test document with fallback method...');
    
    // Check if pdf-parse is available
    try {
      execSync('npm list pdf-parse', { stdio: 'ignore' });
      console.log(`${colors.green}✓${colors.reset} pdf-parse package is installed`);
    } catch (error) {
      console.log(`${colors.yellow}!${colors.reset} pdf-parse package is not installed`);
      console.log('Installing pdf-parse...');
      execSync('npm install pdf-parse', { stdio: 'ignore' });
    }
    
    // Use dynamic import for pdf-parse
    const pdfParse = require('pdf-parse');
    const fileBuffer = await fs.readFile(TEST_DOCUMENT_PATH);
    const data = await pdfParse(fileBuffer);
    
    // Simple chunking strategy - split by paragraphs and limit size
    const textContent = data.text;
    const chunks = [];
    const paragraphs = textContent.split(/\n\s*\n/);
    const maxChunkSize = 1000;
    
    let currentChunk = '';
    let currentChunkSize = 0;
    let chunkIndex = 0;
    
    for (const paragraph of paragraphs) {
      // Skip empty paragraphs
      if (paragraph.trim().length === 0) continue;
      
      // If adding this paragraph would exceed max size, save current chunk
      if (currentChunkSize + paragraph.length > maxChunkSize && currentChunkSize > 0) {
        chunks.push({
          id: `chunk-${chunkIndex++}`,
          text: currentChunk,
          type: 'NarrativeText',
          metadata: {
            page_number: Math.floor(chunkIndex / 5) + 1,  // Approximate page numbers
            filename: 'test-document.pdf'
          }
        });
        currentChunk = '';
        currentChunkSize = 0;
      }
      
      currentChunk += paragraph + '\n\n';
      currentChunkSize += paragraph.length + 2;
    }
    
    // Add the last chunk if not empty
    if (currentChunkSize > 0) {
      chunks.push({
        id: `chunk-${chunkIndex++}`,
        text: currentChunk,
        type: 'NarrativeText',
        metadata: {
          page_number: Math.floor(chunkIndex / 5) + 1,
          filename: 'test-document.pdf'
        }
      });
    }
    
    const outputPath = path.join(TEMP_DIR, 'fallback-output.json');
    await fs.writeFile(outputPath, JSON.stringify(chunks, null, 2));
    
    console.log(`${colors.green}✓${colors.reset} Document processed successfully with fallback method`);
    console.log(`Output saved to: ${outputPath}`);
    console.log(`Created ${chunks.length} chunks`);
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} Failed to process with fallback method`);
    console.log(`Error: ${error.message}`);
  }
  
  console.log('');
}

/**
 * Test Docling processing (if available)
 */
async function testDoclingProcessing() {
  console.log(`${colors.cyan}Testing Docling processing...${colors.reset}`);
  
  // This is a placeholder as Docling is not yet implemented
  console.log(`${colors.yellow}!${colors.reset} Docling integration is not yet fully implemented`);
  console.log(`See docs/DOCLING_INTEGRATION.md for implementation details`);
  
  // Check if Docling is available via npm
  try {
    execSync('npm list docling', { stdio: 'ignore' });
    console.log(`${colors.green}✓${colors.reset} Docling package is installed`);
    
    // Try to use it if installed
    console.log('Attempting to use Docling...');
    try {
      // This will likely fail as Docling is not fully implemented yet
      const docling = require('docling');
      console.log(`${colors.green}✓${colors.reset} Successfully imported Docling`);
    } catch (error) {
      console.log(`${colors.red}✗${colors.reset} Failed to use Docling: ${error.message}`);
    }
  } catch (error) {
    console.log(`${colors.yellow}!${colors.reset} Docling package is not installed`);
    
    // Ask if user wants to try installing it
    const installDocling = await question('Would you like to try installing Docling? (y/n): ');
    if (installDocling.toLowerCase() === 'y') {
      console.log('Attempting to install Docling (this might not work yet)...');
      try {
        execSync('npm install docling', { stdio: 'inherit' });
        console.log(`${colors.green}✓${colors.reset} Docling installed successfully`);
      } catch (error) {
        console.log(`${colors.red}✗${colors.reset} Failed to install Docling: ${error.message}`);
      }
    }
  }
  
  console.log('');
}

// Run the tests
runTests();