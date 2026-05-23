/**
 * categorize.ts — Phase 32.4.B
 *
 * Tự đoán nhóm cho shortcut dựa keyword matching trong tên + đường dẫn.
 * Port từ Python `guess_category()` trong app_launcher.py của Trí.
 *
 * User vẫn có thể override qua dropdown trong Scanner / form.
 */

interface CategoryRule {
  /** nhóm output */
  group: string;
  /** keyword (lowercase, partial match trong combined "name + path") */
  keywords: string[];
}

/**
 * Thứ tự rule = priority. Match đầu tiên thắng.
 * Khớp với DEFAULT_GROUPS trong types.ts:
 *   ['Apps', 'Games', 'Work', 'Web', 'Tools'] + thêm các nhóm phổ biến.
 */
const RULES: CategoryRule[] = [
  {
    group: 'Games',
    keywords: [
      'steam', 'epic games', 'riot', 'valorant', 'league of legends',
      'leagueclient', 'lol', 'dota', 'csgo', 'gta', 'minecraft', 'roblox',
      'origin', 'ubisoft', 'battle.net', 'blizzard', 'unity', 'unreal',
      'pubg', 'fifa', 'pes', 'starcraft', 'warcraft',
    ],
  },
  {
    group: 'Tools', // Dev tools
    keywords: [
      'visual studio', 'vscode', 'vs code', 'cursor', 'sublime', 'atom',
      'intellij', 'pycharm', 'webstorm', 'android studio',
      'git ', 'gitkraken', 'sourcetree', 'github desktop',
      'docker', 'postman', 'insomnia', 'dbeaver', 'mongodb compass',
      'wireshark', 'fiddler', 'putty', 'mobaxterm', 'terminal',
      'powershell', 'cmd', 'wsl', 'node.js', 'npm', 'python',
      'jetbrains', 'eclipse', 'netbeans', 'figma', 'figmadesktop',
    ],
  },
  {
    group: 'Work', // Office + productivity
    keywords: [
      'word', 'excel', 'powerpoint', 'office', 'outlook', 'onenote',
      'access', 'publisher', 'wps', 'libreoffice', 'openoffice',
      'notion', 'obsidian', 'evernote', 'todoist', 'trello',
      'slack', 'teams', 'zoom', 'skype', 'discord',
      'mail', 'thunderbird', 'foxmail', 'spark',
      'pdf', 'foxit', 'acrobat', 'sumatra',
      'autocad', 'revit', 'sketchup', 'civil 3d',
    ],
  },
  {
    group: 'Web', // Browsers + web tools
    keywords: [
      'chrome', 'firefox', 'edge', 'opera', 'brave', 'vivaldi',
      'safari', 'chromium', 'tor browser', 'arc',
    ],
  },
  {
    group: 'Apps', // Media + giải trí + chat
    keywords: [
      'spotify', 'apple music', 'itunes', 'youtube',
      'vlc', 'media player', 'kmplayer', 'potplayer', 'mpc',
      'photoshop', 'illustrator', 'corel', 'gimp', 'krita',
      'paint', 'lightroom', 'davinci', 'premiere', 'after effects',
      'obs', 'streamlabs', 'audacity', 'reaper',
      'telegram', 'whatsapp', 'messenger', 'viber', 'zalo',
      'line', 'wechat', 'imo',
    ],
  },
];

/**
 * Đoán nhóm cho shortcut. Return tên nhóm match, hoặc fallback nếu không match.
 *
 * @param name Tên shortcut (vd "Visual Studio Code")
 * @param path Đường dẫn / target (vd "C:\\Program Files\\Microsoft VS Code\\Code.exe")
 * @param availableGroups Danh sách nhóm hiện tại (đã có trong app). Match phải nằm trong list này.
 * @param fallback Nhóm trả về nếu không match keyword nào
 */
export function guessCategory(
  name: string,
  path: string,
  availableGroups: string[],
  fallback: string,
): string {
  const text = `${name} ${path}`.toLowerCase();

  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        // Chỉ return nhóm nếu có trong availableGroups (user đã tạo)
        if (availableGroups.includes(rule.group)) {
          return rule.group;
        }
      }
    }
  }

  return fallback;
}
