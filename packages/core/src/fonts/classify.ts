import type { FontMeta, FontPersonality } from './types.js';

/**
 * Heuristic classify font personality từ metadata. Không chạm file
 * — chỉ nhìn family name + flags. Đủ dùng cho pair recommendation
 * ở alpha; sau này có thể upgrade bằng panose table hoặc ML.
 *
 * Priority (first match wins):
 *   1. monospace flag                → mono
 *   2. name match slab keywords      → slab
 *   3. name match serif keywords     → serif
 *   4. name match script/handwriting → script/handwriting
 *   5. name match display keywords   → display
 *   6. name match sans keywords      → sans
 *   7. weight ≥800 hoặc width <3/>7  → display
 *   8. default                       → sans (phổ biến nhất)
 */
export function classifyPersonality(meta: FontMeta): FontPersonality {
  if (meta.monospace) return 'mono';

  const name = normalize(meta.family + ' ' + meta.full_name);

  if (contains(name, SLAB_KEYS)) return 'slab';
  if (contains(name, SERIF_KEYS)) return 'serif';
  if (contains(name, SCRIPT_KEYS)) return 'script';
  if (contains(name, HANDWRITING_KEYS)) return 'handwriting';
  if (contains(name, DISPLAY_KEYS)) return 'display';
  if (contains(name, SANS_KEYS)) return 'sans';

  if (meta.weight >= 800) return 'display';
  if (meta.width <= 2 || meta.width >= 8) return 'display';

  return 'sans';
}

const SERIF_KEYS = [
  'serif',
  'times',
  'georgia',
  'garamond',
  'baskerville',
  'caslon',
  'didot',
  'bodoni',
  'cambria',
  'merriweather',
  'lora',
  'crimson',
  'playfair',
  'noto serif',
  'source serif',
  'pt serif',
];

const SLAB_KEYS = [
  'slab',
  'rockwell',
  'courier', // courier là mono serif; mono đã chặn trước → slab
  'clarendon',
  'museo slab',
];

const SCRIPT_KEYS = [
  'script',
  'cursive',
  'dancing',
  'great vibes',
  'allura',
  'sacramento',
  'pacifico',
  'lobster',
];

const HANDWRITING_KEYS = [
  'handwriting',
  'caveat',
  'kalam',
  'shadows into light',
  'architects daughter',
  'permanent marker',
];

const DISPLAY_KEYS = [
  'display',
  'bebas',
  'impact',
  'anton',
  'righteous',
  'black ops',
  'fredoka one',
  'staatliches',
];

const SANS_KEYS = [
  'sans',
  'helvetica',
  'arial',
  'inter',
  'roboto',
  'open sans',
  'noto sans',
  'lato',
  'montserrat',
  'poppins',
  'nunito',
  'ubuntu',
  'raleway',
  'mulish',
  'work sans',
  'dm sans',
  'source sans',
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function contains(haystack: string, needles: readonly string[]): boolean {
  for (const n of needles) {
    if (haystack.includes(n)) return true;
  }
  return false;
}

/** Quick check cho tiếng Việt: kiểm tra 1 char diacritic then giao
 * caller. Thực tế dùng khi Rust không parse được — fallback
 * conservative = false. */
export const VN_DIACRITICS = [
  'à',
  'á',
  'ả',
  'ã',
  'ạ',
  'ă',
  'ằ',
  'ắ',
  'ẳ',
  'ẵ',
  'ặ',
  'â',
  'ầ',
  'ấ',
  'ẩ',
  'ẫ',
  'ậ',
  'đ',
  'è',
  'é',
  'ẻ',
  'ẽ',
  'ẹ',
  'ê',
  'ề',
  'ế',
  'ể',
  'ễ',
  'ệ',
  'ơ',
  'ờ',
  'ớ',
  'ở',
  'ỡ',
  'ợ',
  'ư',
  'ừ',
  'ứ',
  'ử',
  'ữ',
  'ự',
];
