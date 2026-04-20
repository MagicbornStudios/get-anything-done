'use strict';

function buildSnapshotSectionPayload(sections) {
  return sections.map((section) => ({ title: section.title, content: section.content }));
}

function printSections(sections) {
  for (const section of sections) {
    console.log(`-- ${section.title} ${'-'.repeat(Math.max(0, 60 - section.title.length))}`);
    console.log(section.content);
    console.log('');
  }
}

function countSectionTokensApprox(sections) {
  const totalChars = sections.reduce((sum, section) => sum + section.content.length, 0);
  return Math.round(totalChars / 4);
}

module.exports = {
  buildSnapshotSectionPayload,
  countSectionTokensApprox,
  printSections,
};
