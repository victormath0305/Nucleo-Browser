/**
 * Núcleo Browser - Installer Builder & Tester Utility
 * Facilitates quick builds of NSIS installer and portable executables,
 * with options to open output directory or run the installer automatically.
 *
 * Usage:
 *   node scripts/build-installer.js [--nsis] [--portable] [--all] [--open] [--run]
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const pkg = require('../package.json');

const args = process.argv.slice(2);
const shouldRun = args.includes('--run');
const shouldOpen = args.includes('--open');
const isPortableOnly = args.includes('--portable');
const isAll = args.includes('--all');

// By default build NSIS installer (fastest way to get installer)
let targetFlag = '--win nsis';
if (isPortableOnly) {
  targetFlag = '--win portable';
} else if (isAll) {
  targetFlag = '';
}

console.log('====================================================');
console.log(`📦 Compilando Núcleo Browser v${pkg.version}`);
console.log(`🎯 Alvo: ${isPortableOnly ? 'Portable' : isAll ? 'NSIS + Portable' : 'NSIS Installer'}`);
console.log('====================================================\n');

const builderCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const builderArgs = ['electron-builder'];
if (targetFlag) {
  builderArgs.push(...targetFlag.split(' '));
}

const buildProcess = spawn(builderCmd, builderArgs, {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..')
});

buildProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`\n❌ Falha na compilação com código de saída: ${code}`);
    process.exit(code);
  }

  const distDir = path.resolve(__dirname, '..', 'dist');
  const installerName = `Núcleo Browser Setup ${pkg.version}.exe`;
  const installerPath = path.join(distDir, installerName);

  console.log('\n====================================================');
  console.log('✔ Compilação concluída com sucesso!');
  console.log(`📁 Diretório de saída: ${distDir}`);
  if (fs.existsSync(installerPath)) {
    const stats = fs.statSync(installerPath);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`💿 Instalador gerado: ${installerName} (${sizeMb} MB)`);
  }
  console.log('====================================================\n');

  if (shouldOpen) {
    console.log('📂 Abrindo diretório dist no Windows Explorer...');
    if (process.platform === 'win32') {
      spawn('explorer.exe', [distDir], { detached: true, stdio: 'ignore' });
    }
  }

  if (shouldRun) {
    if (fs.existsSync(installerPath)) {
      console.log(`🚀 Iniciando instalador: ${installerName}...`);
      if (process.platform === 'win32') {
        spawn('cmd.exe', ['/c', 'start', '""', installerPath], { detached: true, stdio: 'ignore' });
      }
    } else {
      console.warn(`⚠ Instalador não encontrado no caminho: ${installerPath}`);
    }
  }
});
