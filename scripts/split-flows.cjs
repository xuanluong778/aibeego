const fs = require('fs');
const path = require('path');

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const content = fs.readFileSync(path.join(__dirname, '../review-code/FLOWS.md'), 'utf8');
const lines = content.split('\n');

let currentTier = '';
const flows = [];
let currentFlow = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('### TẦNG ')) {
    currentTier = line.replace('### ', '').trim();
  } else if (line.startsWith('#### FLOW-')) {
    if (currentFlow) flows.push(currentFlow);
    const m = line.match(/#### (FLOW-\d{3}):\s*(.+)/);
    currentFlow = {
      id: m ? m[1] : '',
      title: m ? m[2].trim() : '',
      tier: currentTier,
      lines: []
    };
  } else if (currentFlow) {
    if (line.startsWith('## PHẦN 3:')) {
      flows.push(currentFlow);
      currentFlow = null;
    } else {
      currentFlow.lines.push(line);
    }
  }
}
if (currentFlow) flows.push(currentFlow);

const outDir = path.join(__dirname, '../review-code/Flow');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Compute filenames
flows.forEach((f) => {
  const cleanTitle = f.title.replace(/\([^)]*\)/g, '').trim();
  const slug = slugify(cleanTitle);
  f.filename = `${f.id}-${slug}.md`;
});

// Write each flow file
flows.forEach((f, idx) => {
  const prevFlow = idx > 0 ? flows[idx - 1] : null;
  const nextFlow = idx < flows.length - 1 ? flows[idx + 1] : null;

  let body = f.lines.join('\n').trim();
  // remove trailing markdown hr
  body = body.replace(/---$/, '').trim();

  let fileContent = '';
  fileContent += `# [${f.id}] ${f.title}\n\n`;
  fileContent += `> **Tầng nghiệp vụ**: ${f.tier}  \n`;
  fileContent += `> **Thứ tự thực thi**: ${idx + 1} / ${flows.length}  \n`;
  fileContent += `> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.\n\n`;
  fileContent += `---\n\n`;
  fileContent += `## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ\n\n`;
  fileContent += body + '\n\n';
  fileContent += `---\n\n`;
  fileContent += `## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)\n\n`;
  
  const navParts = [];
  if (prevFlow) {
    navParts.push(`[⬅️ **Luồng trước**: ${prevFlow.id} - ${prevFlow.title}](./${prevFlow.filename})`);
  } else {
    navParts.push(`*Đây là luồng khởi đầu hệ thống*`);
  }
  navParts.push(`[📋 **Mục lục 58 Flows**](./README.md)`);
  if (nextFlow) {
    navParts.push(`[➡️ **Luồng tiếp theo**: ${nextFlow.id} - ${nextFlow.title}](./${nextFlow.filename})`);
  } else {
    navParts.push(`*Đây là luồng cuối cùng trong chuỗi nghiệp vụ*`);
  }
  fileContent += navParts.join(' | ') + '\n';

  fs.writeFileSync(path.join(outDir, f.filename), fileContent, 'utf8');
});

// Write index README.md in Flow folder
let indexContent = '# DANH SÁCH 58 FLOWS NGHIỆP VỤ AIBEEGO (MARKETING SPA)\n\n';
indexContent += '> **Nguyên tắc sắp xếp**: Thứ tự phụ thuộc từ Tầng 0 đến Tầng 14 ("CÓ A MỚI CÓ B").\n';
indexContent += '> **Thư mục lưu trữ**: `D:\\Backup VPS\\Backup new\\aibeego\\review-code\\Flow`\n\n';
indexContent += '---\n\n';

let lastTier = '';
flows.forEach((f, idx) => {
  if (f.tier !== lastTier) {
    lastTier = f.tier;
    indexContent += `\n### ${lastTier}\n\n`;
  }
  indexContent += `${idx + 1}. [**${f.id}**: ${f.title}](./${f.filename})\n`;
});

indexContent += '\n---\n*Toàn bộ 58 files được đánh số thứ tự chuẩn hóa phục vụ review code và kiểm thử tự động.*\n';
fs.writeFileSync(path.join(outDir, 'README.md'), indexContent, 'utf8');

console.log('Successfully generated', flows.length, 'flow files + README.md in', outDir);
