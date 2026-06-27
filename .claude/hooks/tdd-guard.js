// PostToolUse Write|Edit — 소스 파일 수정 시 대응 테스트 파일 존재 여부 검사 (없으면 차단)
const fs = require('fs');
const path = require('path');

try {
  const input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
  const filePath = input.tool_input?.file_path || input.tool_input?.path;
  if (!filePath) process.exit(0);

  const ext = path.extname(filePath);
  const sourceExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs'];
  if (!sourceExts.includes(ext)) process.exit(0);

  const basename = path.basename(filePath, ext);
  const dir = path.dirname(filePath);

  // 테스트 파일 자체, 설정 파일, 훅 파일은 건너뜀
  if (
    basename.includes('.test') ||
    basename.includes('.spec') ||
    basename.includes('_test') ||
    filePath.includes('__tests__') ||
    filePath.includes('.claude/hooks') ||
    filePath.includes('.claude/commands') ||
    /(?:^|\/)scripts\//.test(filePath) ||
    // 설정·인프라 전용 파일 (Service Worker, 빌드·배포·테스트 러너 설정)
    /(?:^|\/)next\.config\.[tj]s$/.test(filePath) ||
    /(?:^|\/)vitest\.config\.[tj]s$/.test(filePath) ||
    /(?:^|\/)vitest\.setup\.[tj]sx?$/.test(filePath) ||
    /(?:^|\/)app\/sw\.ts$/.test(filePath) ||
    /(?:^|\/)playwright\.config\.[tj]s$/.test(filePath) ||
    /(?:^|\/)e2e\//.test(filePath) ||
    // lib/db·lib/ai: IndexedDB·외부 AI API는 브라우저/네트워크 의존 → vitest 단독 테스트 불가
    // 테스트 전략: Playwright E2E (Phase 4) 또는 fake-indexeddb 도입 후 별도 작업으로 추가
    /(?:^|\/)lib\/db\//.test(filePath) ||
    /(?:^|\/)lib\/ai\//.test(filePath) ||
    /(?:^|\/)public\//.test(filePath)
  ) {
    process.exit(0);
  }

  const testPatterns = [
    path.join(dir, `${basename}.test${ext}`),
    path.join(dir, `${basename}.spec${ext}`),
    path.join(dir, '__tests__', `${basename}.test${ext}`),
    path.join(dir, '__tests__', `${basename}.spec${ext}`),
    path.join(path.dirname(dir), '__tests__', `${basename}.test${ext}`),
    path.join(path.dirname(dir), '__tests__', `${basename}.spec${ext}`),
  ];

  const hasTest = testPatterns.some(p => {
    try { return fs.existsSync(p); } catch { return false; }
  });

  if (!hasTest) {
    process.stdout.write(
      `[tdd-guard] 테스트 파일 없음: ${path.relative(process.cwd(), filePath)}\n` +
      `즉시 생성하세요: ${basename}.test${ext}\n`
    );
    process.exit(2);
  }
} catch {}

process.exit(0);
