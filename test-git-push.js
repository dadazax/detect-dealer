// 測試 Git 推送功能
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Git 推送診斷工具\n');
console.log('=' .repeat(60));

// 1. 檢查 Git 是否可用
console.log('\n1️⃣ 檢查 Git 是否可用...');
let gitCmd = 'git';
try {
  const version = execSync('git --version', { encoding: 'utf8' });
  console.log('✅ Git 可用:', version.trim());
} catch (err) {
  console.log('❌ Git 命令不可用，嘗試尋找 Git Bash...');

  const gitBashPaths = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ];

  let gitBashFound = false;
  for (const bashPath of gitBashPaths) {
    if (fs.existsSync(bashPath)) {
      gitCmd = `"${bashPath}" -c`;
      gitBashFound = true;
      console.log(`✅ 找到 Git Bash: ${bashPath}`);
      break;
    }
  }

  if (!gitBashFound) {
    console.log('❌ 找不到 Git 或 Git Bash');
    console.log('\n💡 解決方案：');
    console.log('1. 安裝 Git for Windows: https://git-scm.com/download/win');
    console.log('2. 或將 Git 添加到系統 PATH');
    process.exit(1);
  }
}

// 2. 檢查當前 Git 狀態
console.log('\n2️⃣ 檢查 Git 狀態...');
try {
  const status = execSync('git status --short', { cwd: __dirname, encoding: 'utf8' });
  if (status.trim()) {
    console.log('📝 有未提交的變更：');
    console.log(status);
  } else {
    console.log('✅ 工作區乾淨，沒有未提交的變更');
  }
} catch (err) {
  console.log('❌ 無法檢查 Git 狀態:', err.message);
}

// 3. 創建測試文件
console.log('\n3️⃣ 創建測試文件...');
const testDir = path.join(__dirname, 'docs', 'data');
const testFile = path.join(testDir, 'git-test.json');

if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

fs.writeFileSync(testFile, JSON.stringify({
  test: true,
  timestamp: new Date().toISOString(),
  message: 'Git 推送測試'
}, null, 2));

console.log('✅ 測試文件已創建:', testFile);

// 4. 添加文件
console.log('\n4️⃣ 添加文件到 Git...');
try {
  execSync('git add docs/data/git-test.json', { cwd: __dirname, stdio: 'inherit' });
  console.log('✅ 文件已添加');
} catch (err) {
  console.log('❌ 添加文件失敗:', err.message);
  process.exit(1);
}

// 5. 檢查是否有變更
console.log('\n5️⃣ 檢查是否有變更...');
try {
  execSync('git diff --quiet && git diff --staged --quiet', { cwd: __dirname });
  console.log('ℹ️  沒有變更需要提交（這是正常的，如果文件已經存在）');

  // 清理測試文件
  fs.unlinkSync(testFile);
  console.log('\n🧹 測試文件已清理');
  console.log('\n✅ Git 推送功能測試完成！');
  console.log('\n💡 結論：Git 功能正常。如果之前推送失敗，可能是因為：');
  console.log('   1. 沒有新的變更需要提交');
  console.log('   2. 網絡問題導致推送失敗');
  console.log('   3. GitHub 認證問題');
  process.exit(0);
} catch (err) {
  console.log('✅ 有變更需要提交');
}

// 6. 提交變更
console.log('\n6️⃣ 提交變更...');
try {
  const timestamp = new Date().toLocaleString('zh-TW');
  execSync(`git commit -m "Git 推送測試 - ${timestamp}"`, { cwd: __dirname, stdio: 'inherit' });
  console.log('✅ 提交成功');
} catch (err) {
  console.log('❌ 提交失敗:', err.message);
  process.exit(1);
}

// 7. 推送到 GitHub
console.log('\n7️⃣ 推送到 GitHub（最多重試 3 次）...');
for (let i = 1; i <= 3; i++) {
  try {
    console.log(`\n嘗試推送 (第 ${i} 次)...`);
    execSync('git pull --rebase', { cwd: __dirname, stdio: 'inherit' });
    execSync('git push', { cwd: __dirname, stdio: 'inherit' });
    console.log('\n✅ 推送成功！');

    // 清理測試文件
    try {
      fs.unlinkSync(testFile);
    } catch (e) {}

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Git 推送功能完全正常！');
    console.log('='.repeat(60));
    process.exit(0);
  } catch (err) {
    if (i === 3) {
      console.log('\n❌ 推送失敗（已重試 3 次）');
      console.log('\n可能的原因：');
      console.log('1. 網絡連接問題');
      console.log('2. GitHub 認證過期');
      console.log('3. 遠程倉庫被鎖定');
      console.log('\n💡 建議：');
      console.log('1. 檢查網絡連接');
      console.log('2. 重新登入 GitHub');
      console.log('3. 手動運行: git push');
      process.exit(1);
    }
    console.log('推送失敗，等待 3 秒後重試...');
    const start = Date.now();
    while (Date.now() - start < 3000) {}
  }
}
