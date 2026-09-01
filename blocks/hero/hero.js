import { createOptimizedPicture, readBlockConfig, resolveAnchorValue } from '../../scripts/aem.js';
import { moveInstrumentation, normalizeAemPath } from '../../scripts/scripts.js';

/**
 * Decorates the Hero block for both DA (da.live) and Universal Editor (UE).
 * @param {Element} block
 */
export default function decorate(block) {
  const config = readBlockConfig(block) || {};
  const HORIZONTAL_ALIGNMENT_VALUES = ['left', 'center', 'right'];
  const VERTICAL_ALIGNMENT_VALUES = ['top', 'middle', 'bottom'];

  // Safe row value extractor for DA table rows (Row n, Column 2 or 1)
  const rowVal = (n) => {
    const row = block.querySelector(`:scope > div:nth-child(${n})`);
    if (!row?.children?.length) return undefined;
    const col = row.children[1] ?? row.children[0];
    if (col?.querySelector?.('a')) {
      const as = [...col.querySelectorAll('a')];
      return as.length === 1 ? resolveAnchorValue(as[0]) : as.map(resolveAnchorValue);
    }
    return col?.textContent?.trim();
  };

  const pickFirstMatchingValue = (values, allowedValues) => values
    .map((value) => (value ?? '').toString().trim().toLowerCase())
    .find((value) => allowedValues.includes(value));

  const isHexColor = (s) => /^(#)?[0-9a-fA-F]{3}$|^(#)?[0-9a-fA-F]{6}$/.test(String(s).trim());
  const toHex = (s) => (String(s).trim().startsWith('#') ? String(s).trim() : `#${String(s).trim()}`);

  // Tiered Property Extractions (UE Config -> UE Inline -> DA Row -> Default)
  const enableUnderline = (config.enableunderline ?? block.querySelector('[data-aue-prop="enableunderline"]')?.textContent?.trim() ?? rowVal(3) ?? 'true').toString();
  const layoutStyle = config.herolayout ?? block.querySelector('[data-aue-prop="herolayout"]')?.textContent?.trim() ?? rowVal(4) ?? 'overlay';
  const ctaStyle = config.ctastyle ?? block.querySelector('[data-aue-prop="ctastyle"]')?.textContent?.trim() ?? rowVal(5) ?? 'default';
  const backgroundStyle = config.backgroundstyle ?? block.querySelector('[data-aue-prop="backgroundstyle"]')?.textContent?.trim() ?? rowVal(6) ?? 'default';
  const textOverlayValue = (config.textoverlay ?? block.querySelector('[data-aue-prop="textoverlay"]')?.textContent?.trim() ?? rowVal(16) ?? 'true').toString().toLowerCase();
  const customClass = config['custom-class'] ?? block.querySelector('[data-aue-prop="custom-class"]')?.textContent?.trim() ?? rowVal(15) ?? '';

  // 1. Optimize Image & Move UE Instrumentation
  const img = block.querySelector('picture > img');
  if (img) {
    const optimizedPic = createOptimizedPicture(img.src, img.alt || '', true, [{ width: '2000' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  }

  // 2. Apply Custom & Variant Classes
  if (layoutStyle) block.classList.add(layoutStyle);
  if (backgroundStyle) block.classList.add(backgroundStyle);
  if (textOverlayValue === 'false') block.classList.add('hero--text-overlay-off');
  if (enableUnderline.toLowerCase() === 'false') block.classList.add('removeunderline');
  if (customClass) {
    customClass.split(' ').filter(Boolean).forEach((c) => block.classList.add(c));
  }

  // 3. Background Color Handling
  const backgroundColor = (config.backgroundcolor ?? block.querySelector('[data-aue-prop="backgroundcolor"]')?.textContent?.trim() ?? rowVal(10) ?? '').toString().trim();
  if (backgroundColor && isHexColor(backgroundColor)) {
    block.style.backgroundColor = toHex(backgroundColor);
  }

  // 4. CTA Button Styling & Event Tracking
  const buttonContainer = block.querySelector('p.button-container');
  if (buttonContainer) {
    buttonContainer.classList.add(`cta-${ctaStyle || 'default'}`);
    const ctaLink = buttonContainer.querySelector('a');
    const eventType = config.buttoneventtype ?? block.querySelector('[data-aue-prop="buttoneventtype"]')?.textContent?.trim() ?? rowVal(14);
    if (ctaLink && eventType && String(eventType).trim()) {
      ctaLink.dataset.buttonEventType = String(eventType).trim();
    }
  }

  // 5. Alignment & Dimensions
  const alignment = pickFirstMatchingValue([
    config.alignment,
    block.querySelector('[data-aue-prop="alignment"]')?.textContent?.trim(),
    rowVal(7),
  ], HORIZONTAL_ALIGNMENT_VALUES) ?? 'center';
  block.classList.add(`hero--alignment-${alignment}`);

  const verticalAlignment = pickFirstMatchingValue([
    config.verticalalignment,
    block.querySelector('[data-aue-prop="verticalalignment"]')?.textContent?.trim(),
    rowVal(8),
  ], VERTICAL_ALIGNMENT_VALUES) ?? 'middle';
  block.classList.add(`hero--verticalalignment-${verticalAlignment}`);

  const isFullWidth = config.isfullwidth === 'true' || config.isfullwidth === true || rowVal(9) === 'true';
  if (isFullWidth) block.classList.add('hero--fullwidth');

  let heightVal = (config.height ?? block.querySelector('[data-aue-prop="height"]')?.textContent?.trim() ?? rowVal(10))?.toString()?.trim();
  if (heightVal && heightVal !== 'false' && heightVal !== 'true') {
    if (/^\d+$/.test(heightVal)) heightVal = `${heightVal}px`;
    block.style.minHeight = heightVal;
  }

  // 6. Text Color Logic
  let textColorRaw = (config.color ?? block.querySelector('[data-aue-prop="color"]')?.textContent?.trim() ?? rowVal(11))?.toString()?.trim() ?? '';
  if (!textColorRaw) {
    const hexLink = block.querySelector('a[href^="#"]');
    const href = hexLink?.getAttribute('href')?.trim() || '';
    if (href && isHexColor(href)) textColorRaw = href.replace(/^#/, '');
  }
  if (textColorRaw && isHexColor(textColorRaw)) {
    block.style.setProperty('--hero-text-color', toHex(textColorRaw));
    block.classList.add('hero--custom-text-color');
  }

  // 7. Interactive Section Link
  const sectionLinkRaw = (config.link ?? block.querySelector('[data-aue-prop="link"]')?.textContent?.trim() ?? rowVal(13)) && String(config.link ?? rowVal(13)).trim();
  if (sectionLinkRaw && !isHexColor(sectionLinkRaw)) {
    block.dataset.sectionLink = sectionLinkRaw;
    block.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return; // Allow buttons inside hero to work normally
      if (/^https?:\/\//i.test(sectionLinkRaw)) {
        try {
          if (!new URL(sectionLinkRaw).pathname.startsWith('/content/')) {
            window.location.href = sectionLinkRaw;
            return;
          }
        } catch {
          window.location.href = sectionLinkRaw;
          return;
        }
      }
      window.location.href = normalizeAemPath(sectionLinkRaw);
    });
  }

  // 8. Soft-hide Configuration Rows for Live Frontend (Preserves UE Overlay Data)
  [...block.children].forEach((row, index) => {
    if (index >= 2) row.style.display = 'none';
  });
}