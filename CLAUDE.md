# MORPHIC PROJECT GUIDELINES

## Build Commands
- `npm run dev` - Start development server with Turbo
- `npm run build` - Build the production version
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint

## Code Style
- **Formatting**: Single quotes, no semicolons, 2-space indent, trailing commas in arrays only
- **Imports**: Follow order in prettier.config.js: React > Next > third-party > internal (@/*)
- **Components**: Use functional components with arrow functions or named functions
- **Types**: TypeScript strict mode, explicit return types on complex functions
- **Naming**: PascalCase for components, camelCase for functions/variables
- **Commits**: Follow conventional commits (feat, fix, docs, chore, refactor)

## Error Handling
- Use try/catch blocks for async operations
- Error messages should be user-friendly with toast notifications
- Log detailed errors to console for debugging

## Component Structure
- 'use client' directive at the top of client components
- Props interface/type defined inline for smaller components
- Extract complex logic to hooks in lib/hooks directory
- Use Tailwind for styling with cn utility for conditionals