# Setup Instructions for shadcn, Tailwind CSS, and TypeScript

Your project currently follows a Flask-based structure with manual React component folders. To fully support the `AnimeNavBar` and other React components, follow these steps:

## 1. Initialize Node Project
If you haven't already, initialize a `package.json` in your root:
```bash
npm init -y
```

## 2. Install Dependencies
Install the required packages for the `AnimeNavBar` and shadcn utilities:
```bash
npm install lucide-react framer-motion clsx tailwind-merge
```

## 3. Setup Tailwind CSS
Install Tailwind CSS and its dependencies:
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```
Update your `tailwind.config.js` with the content provided in the implementation plan.

## 4. Setup TypeScript
Install TypeScript if you want to use `.tsx` files properly:
```bash
npm install -D typescript @types/react @types/react-dom @types/node
npx tsc --init
```
Update `tsconfig.json` to include path mappings for the `@/` alias:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

## Why /components/ui?
It is important to use the `/components/ui` folder because:
- **shadcn CLI Compatibility**: The shadcn CLI defaults to this path for base components.
- **Organization**: Keeps reusable primitive components separate from feature-specific components.
- **Standardization**: Most modern React projects follow this convention, making it easier for collaborators to understand the project structure.
