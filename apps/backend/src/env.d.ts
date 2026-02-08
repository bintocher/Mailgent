// Node.js 22+ ESM import.meta extensions
// TypeScript with moduleResolution: "bundler" doesn't include these automatically
interface ImportMeta {
  dirname: string;
  filename: string;
}
