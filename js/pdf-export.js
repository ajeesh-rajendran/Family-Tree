/* ============================================
   pdf-export.js — A4 PDF Export with jsPDF
   Generates a clean family tree PDF
   ============================================ */

const PdfExport = (() => {
  // A4 dimensions in mm
  const A4_W = 297; // landscape width
  const A4_H = 210; // landscape height
  const MARGIN = 12;
  const USABLE_W = A4_W - MARGIN * 2;
  const USABLE_H = A4_H - MARGIN * 2;

  // Colors
  const COLORS = {
    bg: [15, 20, 35],
    cardBg: [30, 40, 65],
    cardBorder: [6, 182, 212],
    cardBorderLate: [107, 114, 128],
    text: [241, 245, 249],
    textMuted: [148, 163, 184],
    textLate: [107, 114, 128],
    accent: [6, 182, 212],
    accentPurple: [139, 92, 246],
    connector: [6, 182, 212, 0.4],
    spouseTag: [167, 139, 250],
    headerGradientStart: [6, 182, 212],
    headerGradientEnd: [139, 92, 246],
  };

  function init() {
    document.getElementById('btnExportPdf').addEventListener('click', exportPdf);
  }

  async function exportPdf() {
    const overlay = document.getElementById('pdfLoadingOverlay');
    overlay.classList.add('active');

    try {
      // Small delay to show loading
      await new Promise(r => setTimeout(r, 100));

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const data = FamilyTree.getTree();
      const rootId = data.rootId;

      if (!rootId || !data.persons[rootId]) {
        showToast('No family tree data to export', 'error');
        overlay.classList.remove('active');
        return;
      }

      // Calculate the tree layout
      const layout = calculateLayout(rootId, data);

      // Draw background
      pdf.setFillColor(...COLORS.bg);
      pdf.rect(0, 0, A4_W, A4_H, 'F');

      // Draw header
      drawHeader(pdf, data, rootId);

      // The tree area starts below the header
      const treeStartY = 28;
      const treeAreaH = USABLE_H - (treeStartY - MARGIN) - 8;

      // Scale tree to fit
      const scaleX = USABLE_W / layout.totalWidth;
      const scaleY = treeAreaH / layout.totalHeight;
      const scale = Math.min(scaleX, scaleY, 1); // don't scale up

      const offsetX = MARGIN + (USABLE_W - layout.totalWidth * scale) / 2;
      const offsetY = treeStartY + (treeAreaH - layout.totalHeight * scale) / 2;

      // Draw connectors first (behind cards)
      drawConnectors(pdf, layout, data, scale, offsetX, offsetY);

      // Draw person cards
      drawCards(pdf, layout, data, scale, offsetX, offsetY);

      // Draw footer
      drawFooter(pdf);

      // Check if we need multiple pages for detailed member list
      addMemberListPages(pdf, data);

      pdf.save('Vaaravil_Family_Tree.pdf');
      showToast('PDF exported successfully!', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('Failed to generate PDF', 'error');
    } finally {
      overlay.classList.remove('active');
    }
  }

  // --- Header ---
  function drawHeader(pdf, data, rootId) {
    // Gradient bar
    const steps = 60;
    for (let i = 0; i < steps; i++) {
      const ratio = i / steps;
      const r = Math.round(COLORS.headerGradientStart[0] + (COLORS.headerGradientEnd[0] - COLORS.headerGradientStart[0]) * ratio);
      const g = Math.round(COLORS.headerGradientStart[1] + (COLORS.headerGradientEnd[1] - COLORS.headerGradientStart[1]) * ratio);
      const b = Math.round(COLORS.headerGradientStart[2] + (COLORS.headerGradientEnd[2] - COLORS.headerGradientStart[2]) * ratio);
      pdf.setFillColor(r, g, b);
      pdf.rect(MARGIN + (USABLE_W / steps) * i, MARGIN, USABLE_W / steps + 0.5, 0.8, 'F');
    }

    // Title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(...COLORS.text);
    pdf.text('Vaaravil Family Tree', MARGIN + 2, MARGIN + 7);

    // Stats
    const totalPersons = Object.keys(data.persons).length;
    const generations = FamilyTree.getGenerationCount(rootId, data);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.textMuted);
    pdf.text(`${totalPersons} members  ·  ${generations} generations`, MARGIN + 2, MARGIN + 12);

    // Date
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    pdf.text(`Generated: ${dateStr}`, A4_W - MARGIN - 2, MARGIN + 7, { align: 'right' });
  }

  // --- Footer ---
  function drawFooter(pdf) {
    pdf.setFontSize(6);
    pdf.setTextColor(...COLORS.textMuted);
    pdf.text('Vaaravil Family Tree', A4_W / 2, A4_H - 4, { align: 'center' });
  }

  // --- Tree Layout Calculation ---
  function calculateLayout(rootId, data) {
    const CARD_W = 42;
    const CARD_H = 22;
    const H_GAP = 8;
    const V_GAP = 16;

    // Calculate subtree widths recursively
    function getSubtreeWidth(personId) {
      const person = data.persons[personId];
      if (!person || !person.children || person.children.length === 0) {
        return CARD_W;
      }
      let totalChildWidth = 0;
      person.children.forEach((cid, i) => {
        totalChildWidth += getSubtreeWidth(cid);
        if (i < person.children.length - 1) totalChildWidth += H_GAP;
      });
      return Math.max(CARD_W, totalChildWidth);
    }

    // Position nodes
    const positions = {};
    let maxDepth = 0;

    function positionNode(personId, x, y, availableWidth, depth) {
      if (depth > maxDepth) maxDepth = depth;
      const person = data.persons[personId];
      if (!person) return;

      // Center this card in available width
      const cardX = x + (availableWidth - CARD_W) / 2;
      positions[personId] = { x: cardX, y, w: CARD_W, h: CARD_H, depth };

      if (person.children && person.children.length > 0) {
        const childY = y + CARD_H + V_GAP;
        let childX = x;

        // Distribute children across available width
        const totalChildSubtreeWidth = person.children.reduce((sum, cid, i) => {
          return sum + getSubtreeWidth(cid) + (i < person.children.length - 1 ? H_GAP : 0);
        }, 0);

        const childStartX = x + (availableWidth - totalChildSubtreeWidth) / 2;
        childX = childStartX;

        person.children.forEach((cid, i) => {
          const childWidth = getSubtreeWidth(cid);
          positionNode(cid, childX, childY, childWidth, depth + 1);
          childX += childWidth + H_GAP;
        });
      }
    }

    const totalWidth = getSubtreeWidth(rootId);
    positionNode(rootId, 0, 0, totalWidth, 0);

    const totalHeight = (maxDepth + 1) * CARD_H + maxDepth * V_GAP;

    return { positions, totalWidth, totalHeight, CARD_W, CARD_H, V_GAP };
  }

  // --- Draw Connectors ---
  function drawConnectors(pdf, layout, data, scale, offsetX, offsetY) {
    const { positions, CARD_W, CARD_H, V_GAP } = layout;

    pdf.setDrawColor(6, 182, 212);
    pdf.setLineWidth(0.3);

    Object.keys(positions).forEach(personId => {
      const person = data.persons[personId];
      if (!person || !person.children || person.children.length === 0) return;

      const parentPos = positions[personId];
      const parentCenterX = (parentPos.x + CARD_W / 2) * scale + offsetX;
      const parentBottomY = (parentPos.y + CARD_H) * scale + offsetY;

      const midY = parentBottomY + (V_GAP * scale) / 2;

      // Vertical line from parent down to mid
      pdf.line(parentCenterX, parentBottomY, parentCenterX, midY);

      if (person.children.length === 1) {
        const childPos = positions[person.children[0]];
        if (childPos) {
          const childCenterX = (childPos.x + CARD_W / 2) * scale + offsetX;
          const childTopY = childPos.y * scale + offsetY;
          pdf.line(childCenterX, midY, childCenterX, childTopY);
        }
      } else {
        // Horizontal bar
        const firstChild = positions[person.children[0]];
        const lastChild = positions[person.children[person.children.length - 1]];
        if (firstChild && lastChild) {
          const leftX = (firstChild.x + CARD_W / 2) * scale + offsetX;
          const rightX = (lastChild.x + CARD_W / 2) * scale + offsetX;
          pdf.line(leftX, midY, rightX, midY);

          // Vertical lines down to each child
          person.children.forEach(cid => {
            const childPos = positions[cid];
            if (childPos) {
              const childCenterX = (childPos.x + CARD_W / 2) * scale + offsetX;
              const childTopY = childPos.y * scale + offsetY;
              pdf.line(childCenterX, midY, childCenterX, childTopY);
            }
          });
        }
      }
    });
  }

  // --- Draw Cards ---
  function drawCards(pdf, layout, data, scale, offsetX, offsetY) {
    const { positions, CARD_W, CARD_H } = layout;

    Object.keys(positions).forEach(personId => {
      const person = data.persons[personId];
      const pos = positions[personId];
      if (!person || !pos) return;

      const x = pos.x * scale + offsetX;
      const y = pos.y * scale + offsetY;
      const w = CARD_W * scale;
      const h = CARD_H * scale;

      // Card background
      pdf.setFillColor(...COLORS.cardBg);
      pdf.roundedRect(x, y, w, h, 1.5, 1.5, 'F');

      // Card border
      if (person.isLate) {
        pdf.setDrawColor(...COLORS.cardBorderLate);
      } else {
        pdf.setDrawColor(...COLORS.cardBorder);
      }
      pdf.setLineWidth(0.2);
      pdf.roundedRect(x, y, w, h, 1.5, 1.5, 'S');

      // Name
      const nameColor = person.isLate ? COLORS.textLate : COLORS.text;
      pdf.setFont('helvetica', 'bold');
      const fontSize = Math.max(5, 7 * scale);
      pdf.setFontSize(fontSize);
      pdf.setTextColor(...nameColor);
      const name = person.name.length > 18 ? person.name.substring(0, 16) + '…' : person.name;
      pdf.text(name, x + w / 2, y + h * 0.35, { align: 'center' });

      // Late indicator
      if (person.isLate) {
        pdf.setFontSize(Math.max(4, 5 * scale));
        pdf.setTextColor(...COLORS.textLate);
        pdf.text('(Late)', x + w / 2, y + h * 0.55, { align: 'center' });
      }

      // Spouse
      if (person.spouseName) {
        const spouseColor = person.spouseIsLate ? COLORS.textLate : COLORS.spouseTag;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(Math.max(3.5, 5 * scale));
        pdf.setTextColor(...spouseColor);
        const spousePrefix = person.spouseIsLate ? '✝ ' : '♥ ';
        const spouseName = person.spouseName.length > 16 ? person.spouseName.substring(0, 14) + '…' : person.spouseName;
        pdf.text(spousePrefix + spouseName, x + w / 2, y + h * (person.isLate ? 0.75 : 0.65), { align: 'center' });
      }

      // Mobile (small, at bottom)
      if (!person.isLate && person.mobile) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(Math.max(3, 4 * scale));
        pdf.setTextColor(...COLORS.textMuted);
        pdf.text(person.mobile, x + w / 2, y + h * 0.88, { align: 'center' });
      }
    });
  }

  // --- Member List Pages ---
  function addMemberListPages(pdf, data) {
    const persons = Object.values(data.persons);
    if (persons.length === 0) return;

    pdf.addPage('a4', 'portrait');
    const PW = 210;
    const PH = 297;
    const M = 15;

    // Background
    pdf.setFillColor(...COLORS.bg);
    pdf.rect(0, 0, PW, PH, 'F');

    // Title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(...COLORS.text);
    pdf.text('Vaaravil Family — Member Directory', M, M + 6);

    // Gradient bar
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      const ratio = i / steps;
      const r = Math.round(6 + (139 - 6) * ratio);
      const g = Math.round(182 + (92 - 182) * ratio);
      const b = Math.round(212 + (246 - 212) * ratio);
      pdf.setFillColor(r, g, b);
      pdf.rect(M + ((PW - M * 2) / steps) * i, M + 9, (PW - M * 2) / steps + 0.5, 0.6, 'F');
    }

    let yPos = M + 16;
    const lineH = 5;
    const colName = M;
    const colSpouse = M + 55;
    const colMobile = M + 105;
    const colAddress = M + 145;
    const colStatus = M + 175;

    // Table header
    pdf.setFillColor(25, 35, 55);
    pdf.rect(M, yPos - 3.5, PW - M * 2, 6, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.setTextColor(...COLORS.accent);
    pdf.text('NAME', colName + 2, yPos);
    pdf.text('SPOUSE', colSpouse, yPos);
    pdf.text('MOBILE', colMobile, yPos);
    pdf.text('ADDRESS', colAddress, yPos);
    pdf.text('STATUS', colStatus, yPos);
    yPos += lineH + 1;

    // Sort: by generation depth then name
    const sortedPersons = persons.sort((a, b) => {
      const depthA = getDepth(a.id, data);
      const depthB = getDepth(b.id, data);
      if (depthA !== depthB) return depthA - depthB;
      return a.name.localeCompare(b.name);
    });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6);

    sortedPersons.forEach((person, idx) => {
      if (yPos > PH - M - 10) {
        // New page
        pdf.addPage('a4', 'portrait');
        pdf.setFillColor(...COLORS.bg);
        pdf.rect(0, 0, PW, PH, 'F');
        yPos = M + 6;
      }

      // Alternating row background
      if (idx % 2 === 0) {
        pdf.setFillColor(20, 28, 45);
        pdf.rect(M, yPos - 3.5, PW - M * 2, lineH, 'F');
      }

      const textColor = person.isLate ? COLORS.textLate : COLORS.text;
      pdf.setTextColor(...textColor);

      // Name
      const name = person.name.length > 22 ? person.name.substring(0, 20) + '…' : person.name;
      pdf.text(name, colName + 2, yPos);

      // Spouse
      if (person.spouseName) {
        const spouseColor = person.spouseIsLate ? COLORS.textLate : COLORS.textMuted;
        pdf.setTextColor(...spouseColor);
        const sName = person.spouseName.length > 18 ? person.spouseName.substring(0, 16) + '…' : person.spouseName;
        pdf.text((person.spouseIsLate ? '✝ ' : '') + sName, colSpouse, yPos);
      }

      // Mobile
      pdf.setTextColor(...COLORS.textMuted);
      if (person.mobile) pdf.text(person.mobile, colMobile, yPos);

      // Address
      if (person.address) {
        const addr = person.address.length > 20 ? person.address.substring(0, 18) + '…' : person.address;
        pdf.text(addr, colAddress, yPos);
      }

      // Status
      if (person.isLate) {
        pdf.setTextColor(...COLORS.textLate);
        pdf.text('Late', colStatus, yPos);
      } else {
        pdf.setTextColor(34, 197, 94);
        pdf.text('Alive', colStatus, yPos);
      }

      yPos += lineH;
    });

    // Footer on last page
    pdf.setFontSize(5);
    pdf.setTextColor(...COLORS.textMuted);
    pdf.text('Vaaravil Family Tree — Member Directory', PW / 2, PH - 5, { align: 'center' });
  }

  function getDepth(personId, data) {
    let depth = 0;
    let current = data.persons[personId];
    while (current && current.parentId) {
      depth++;
      current = data.persons[current.parentId];
    }
    return depth;
  }

  return { init };
})();

// Bootstrap after DOM
document.addEventListener('DOMContentLoaded', () => {
  PdfExport.init();
});
