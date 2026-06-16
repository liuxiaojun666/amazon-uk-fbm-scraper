/** Node 18+ required (playwright 1.48). */
export function assertNodeVersion() {
  const major = Number.parseInt(process.versions.node.split('.')[0], 10);
  if (major >= 18) return;

  console.error('');
  console.error(`ERROR: Node.js 18+ required (current: ${process.version}).`);
  console.error('');
  console.error('Windows: double-click 启动 Web.bat to auto-install Node 20.');
  console.error('Or install LTS from https://nodejs.org/ then run: npm run setup');
  console.error('');
  process.exit(1);
}
