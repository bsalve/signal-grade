function printReport(results) {
  console.log('='.repeat(50));
  console.log('LOCAL SEO AUDIT REPORT');
  console.log('='.repeat(50));

  let passed = 0;
  let failed = 0;
  let warnings = 0;

  for (const result of results) {
    const icon = result.status === 'pass' ? '✓' : result.status === 'warn' ? '⚠' : '✗';
    const scoreLabel = result.score !== undefined ? ` (score: ${result.score}/100)` : '';
    console.log(`\n[${icon}] ${result.name}${scoreLabel}`);
    console.log(`    ${result.message}`);
    if (result.details) {
      console.log(`    Details: ${result.details}`);
    }
    if (result.recommendation) {
      console.log(`    Recommendation: ${result.recommendation}`);
    }

    if (result.status === 'pass') passed++;
    else if (result.status === 'warn') warnings++;
    else failed++;
  }

  console.log('\n' + '='.repeat(50));
  console.log(`SUMMARY: ${passed} passed, ${warnings} warnings, ${failed} failed`);
  console.log('='.repeat(50) + '\n');
}

module.exports = { printReport };
