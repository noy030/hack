// ═══════════════════════════════════════════════════════════════════
//  הגדרות תיבות — ערוך כאן בלבד
//
//  ⚠ קודי הפתיחה של התיבות לא נמצאים כאן יותר!
//    הם נשמרים ב-Firebase ונערכים מלוח הבקרה (admin.html ← לשונית "תיבות").
//    הריפו ציבורי, ולכן כל מה שכתוב בקובץ הזה גלוי לכל אחד.
//
//  game:     'shooter' | 'sequence' | 'blocks'
//  diff:     1=קל  2=בינוני  3=קשה
//
//  SHOOTER — שדות נוספים:
//    coreHp   — נקודות חיים של הגרעין
//    walls    — מספר חומות
//    time     — זמן בשניות
//    fireMode — 'aimed' | 'spiral' | 'burst' | 'random' | 'ring' | 'tracking' | 'swarm'
//    wallMode — 'orbit' | 'static' | 'expand' | 'zigzag'
//
//  SEQUENCE — שדות נוספים:
//    sequences   — כמה רצפים לעבור (1-3)
//    baseLen     — אורך רצף ראשון
//    timePerSeq  — זמן לכל רצף
//    showSpeed   — מהירות הצגה: 'slow'|'normal'|'fast'
//    nodeCount   — כמה כפתורים גלויים: 4|7|10
//    noise       — האם יש הסחות דעת: true|false
//
//  BLOCKS — שדות נוספים:
//    puzzleSet   — 'easy'|'medium'|'hard'  (קובע את סט הפאזלים)
//    time        — זמן לכל פאזל
//    puzzles     — כמה פאזלים לעבור (1-3)
// ═══════════════════════════════════════════════════════════════════

var BOXES = {
  // ── קל ──────────────────────────────────────────────────────────
  '1':  { game:'shooter',  title:'ALPHA-01', diff:1, coreHp:6,  walls:4, time:70, fireMode:'aimed',    wallMode:'static' },
  '2':  { game:'shooter',  title:'ALPHA-02', diff:1, coreHp:6,  walls:5, time:65, fireMode:'random',   wallMode:'static' },
  '3':  { game:'shooter',  title:'ALPHA-03', diff:1, coreHp:7,  walls:4, time:65, fireMode:'burst',    wallMode:'orbit'  },
  '4':  { game:'sequence', title:'ALPHA-04', diff:1, sequences:2, baseLen:4, timePerSeq:55, showSpeed:'slow',   nodeCount:4,  noise:false },
  '5':  { game:'sequence', title:'ALPHA-05', diff:1, sequences:2, baseLen:4, timePerSeq:50, showSpeed:'normal', nodeCount:7,  noise:false },
  '6':  { game:'blocks',   title:'ALPHA-06', diff:1, puzzleSet:'medium', time:70, puzzles:1 },
  '7':  { game:'blocks',   title:'ALPHA-07', diff:1, puzzleSet:'medium', time:65, puzzles:1 },
  '8':  { game:'shooter',  title:'ALPHA-08', diff:1, coreHp:7,  walls:5, time:60, fireMode:'spiral',   wallMode:'static' },
  '9':  { game:'sequence', title:'ALPHA-09', diff:1, sequences:2, baseLen:4, timePerSeq:50, showSpeed:'slow',   nodeCount:4,  noise:false },
  '10': { game:'blocks',   title:'ALPHA-10', diff:1, puzzleSet:'medium', time:60, puzzles:2 },

  // ── בינוני ─────────────────────────────────────────────────────
  '11': { game:'shooter',  title:'BETA-11',  diff:2, coreHp:11, walls:7, time:50, fireMode:'aimed',    wallMode:'orbit'   },
  '12': { game:'shooter',  title:'BETA-12',  diff:2, coreHp:9,  walls:6, time:55, fireMode:'aimed',    wallMode:'orbit'   },
  '13': { game:'shooter',  title:'BETA-13',  diff:2, coreHp:12, walls:7, time:45, fireMode:'spiral',   wallMode:'zigzag'  },
  '14': { game:'sequence', title:'BETA-14',  diff:2, sequences:3, baseLen:5, timePerSeq:40, showSpeed:'normal', nodeCount:7,  noise:false },
  '15': { game:'sequence', title:'BETA-15',  diff:2, sequences:3, baseLen:5, timePerSeq:42, showSpeed:'normal', nodeCount:7,  noise:false },
  '16': { game:'sequence', title:'BETA-16',  diff:2, sequences:3, baseLen:5, timePerSeq:40, showSpeed:'normal', nodeCount:10, noise:false },
  '17': { game:'blocks',   title:'BETA-17',  diff:2, puzzleSet:'hard',   time:55, puzzles:1 },
  '18': { game:'blocks',   title:'BETA-18',  diff:2, puzzleSet:'hard',   time:55, puzzles:1 },
  '19': { game:'shooter',  title:'BETA-19',  diff:2, coreHp:10, walls:8, time:48, fireMode:'ring',     wallMode:'orbit'   },
  '20': { game:'blocks',   title:'BETA-20',  diff:2, puzzleSet:'hard',   time:55, puzzles:1 },

  // ── קשה ───────────────────────────────────────────────────────
  '21': { game:'shooter',  title:'GAMMA-21', diff:3, coreHp:20, walls:12,time:38, fireMode:'tracking', wallMode:'expand'  },
  '22': { game:'shooter',  title:'GAMMA-22', diff:3, coreHp:18, walls:12,time:40, fireMode:'spiral',   wallMode:'zigzag'  },
  '23': { game:'shooter',  title:'GAMMA-23', diff:3, coreHp:16, walls:10,time:42, fireMode:'spiral',   wallMode:'orbit'   },
  '24': { game:'sequence', title:'GAMMA-24', diff:3, sequences:3, baseLen:6, timePerSeq:35, showSpeed:'normal', nodeCount:7,  noise:false  },
  '25': { game:'sequence', title:'GAMMA-25', diff:3, sequences:3, baseLen:6, timePerSeq:32, showSpeed:'normal', nodeCount:7,  noise:false  },
  '26': { game:'sequence', title:'GAMMA-26', diff:3, sequences:3, baseLen:6, timePerSeq:35, showSpeed:'normal', nodeCount:7,  noise:false  },
  '27': { game:'blocks',   title:'GAMMA-27', diff:3, puzzleSet:'hard', time:45, puzzles:1 },
  '28': { game:'blocks',   title:'GAMMA-28', diff:3, puzzleSet:'hard', time:45, puzzles:1 },
  '29': { game:'shooter',  title:'GAMMA-29', diff:3, coreHp:25, walls:14,time:32, fireMode:'burst',    wallMode:'zigzag'  },
  '30': { game:'blocks',   title:'GAMMA-30', diff:3, puzzleSet:'hard', time:45, puzzles:2 }
};

var GAME_FILES = { shooter:'shooter.html', sequence:'sequence.html', blocks:'nodes.html' };
