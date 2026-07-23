// 词形还原（Lemmatizer）：将变形词还原为词典原形
//
// 用途：解决 studies/studied/studying 查不到的问题
// 策略：规则 + 不规则词典，生成候选列表，上层按顺序尝试
//
// 候选优先级：
//   1. 原词（直接查）
//   2. 不规则变换（go/went/gone, be/was/is 等）
//   3. 后缀规则：-ies/-ied/-ying/-es/-s/-ed/-ing/-er/-est/-ly
//
// 使用：
//   const candidates = lemmatize('studies')  // ['studies', 'study', 'stude', ...]
//   for (const c of candidates) {
//     const r = await lookupLocal(c)
//     if (r.found) return r
//   }

// ============================================================
// 不规则变形表（高频考研词，按字典序）
// ============================================================
const IRREGULAR: Record<string, string[]> = {
  // be 动词
  am: ['be'],
  is: ['be'],
  are: ['be'],
  was: ['be'],
  were: ['be'],
  been: ['be'],
  being: ['be'],
  // 助动词
  has: ['have'],
  have: ['have'],
  had: ['have'],
  having: ['have'],
  does: ['do'],
  did: ['do'],
  done: ['do'],
  doing: ['do'],
  // 情态
  could: ['can'],
  would: ['will'],
  should: ['shall'],
  might: ['may'],
  // 高频动词
  went: ['go'],
  gone: ['go'],
  goes: ['go'],
  going: ['go'],
  took: ['take'],
  taken: ['take'],
  takes: ['take'],
  taking: ['take'],
  gave: ['give'],
  given: ['give'],
  gives: ['give'],
  giving: ['give'],
  came: ['come'],
  come: ['come'],
  comes: ['come'],
  coming: ['come'],
  got: ['get'],
  gotten: ['get'],
  gets: ['get'],
  getting: ['get'],
  made: ['make'],
  makes: ['make'],
  making: ['make'],
  knew: ['know'],
  known: ['know'],
  knows: ['know'],
  knowing: ['know'],
  saw: ['see'],
  seen: ['see'],
  sees: ['see'],
  seeing: ['see'],
  found: ['find'],
  finds: ['find'],
  finding: ['find'],
  told: ['tell'],
  tells: ['tell'],
  telling: ['tell'],
  thought: ['think'],
  thinks: ['think'],
  thinking: ['think'],
  felt: ['feel'],
  feels: ['feel'],
  feeling: ['feel'],
  left: ['leave'],
  leaves: ['leave', 'leaf'],
  leaving: ['leave'],
  put: ['put'],
  putting: ['put'],
  let: ['let'],
  letting: ['let'],
  set: ['set'],
  setting: ['set'],
  met: ['meet'],
  meets: ['meet'],
  meeting: ['meet'],
  ran: ['run'],
  runs: ['run'],
  running: ['run'],
  sat: ['sit'],
  sits: ['sit'],
  sitting: ['sit'],
  stood: ['stand'],
  stands: ['stand'],
  standing: ['stand'],
  spoke: ['speak'],
  spoken: ['speak'],
  speaks: ['speak'],
  speaking: ['speak'],
  wrote: ['write'],
  written: ['write'],
  writes: ['write'],
  writing: ['write'],
  read: ['read'],
  reads: ['read'],
  reading: ['read'],
  chose: ['choose'],
  chosen: ['choose'],
  chooses: ['choose'],
  choosing: ['choose'],
  began: ['begin'],
  begun: ['begin'],
  begins: ['begin'],
  beginning: ['begin'],
  broke: ['break'],
  broken: ['break'],
  breaks: ['break'],
  breaking: ['break'],
  brought: ['bring'],
  brings: ['bring'],
  bringing: ['bring'],
  bought: ['buy'],
  buys: ['buy'],
  buying: ['buy'],
  caught: ['catch'],
  catches: ['catch'],
  catching: ['catch'],
  taught: ['teach'],
  teaches: ['teach'],
  teaching: ['teach'],
  fought: ['fight'],
  fights: ['fight'],
  fighting: ['fight'],
  sought: ['seek'],
  seeks: ['seek'],
  seeking: ['seek'],
  // 复数不规则
  men: ['man'],
  women: ['woman'],
  children: ['child'],
  feet: ['foot'],
  teeth: ['tooth'],
  geese: ['goose'],
  mice: ['mouse'],
  people: ['person'],
  // 形容词比较级
  better: ['good', 'well'],
  best: ['good', 'well'],
  worse: ['bad'],
  worst: ['bad'],
  more: ['much', 'many'],
  most: ['much', 'many'],
  less: ['little'],
  least: ['little'],
  farther: ['far'],
  farthest: ['far'],
  further: ['far'],
  furthest: ['far'],
  bigger: ['big'],
  biggest: ['big'],
  larger: ['large'],
  largest: ['large'],
  smaller: ['small'],
  smallest: ['small'],
  older: ['old'],
  oldest: ['old'],
  elder: ['old'],
  eldest: ['old'],
  younger: ['young'],
  youngest: ['young'],
  easier: ['easy'],
  easiest: ['easy'],
  earlier: ['early'],
  earliest: ['early'],
  later: ['late'],
  latest: ['late'],
  latter: ['late'],
  last: ['late'],
  happier: ['happy'],
  happiest: ['happy'],
  heavier: ['heavy'],
  heaviest: ['heavy'],
  prettier: ['pretty'],
  prettiest: ['pretty'],
  simpler: ['simple'],
  simplest: ['simple'],
  commoner: ['common'],
  commonest: ['common'],
}

// ============================================================
// 后缀规则
// ============================================================

interface SuffixRule {
  suffix: string
  /** 处理函数：去掉后缀后的剩余部分 → 候选原形 */
  transform: (base: string) => string[]
}

// 注意：调用方会按数组顺序逐条尝试，所以这里按"最可能"顺序排列
const SUFFIX_RULES: SuffixRule[] = [
  // -ies → y （studies → study）
  {
    suffix: 'ies',
    transform: (base) => [base + 'y'],
  },
  // -ied → y （studied → study）
  {
    suffix: 'ied',
    transform: (base) => [base + 'y'],
  },
  // -ying → （用于 -ie 结尾词：lying → lie）
  {
    suffix: 'ying',
    transform: (base) => [base + 'ie', base + 'y'],
  },
  // -ing 去 e （running → run, making → make）
  // 短基础词需要双写还原（running → run；making → make）
  {
    suffix: 'ing',
    transform: (base) => {
      const candidates: string[] = []
      // 双写辅音还原：running → run（去末尾重复辅音）
      if (base.length >= 2 && base[base.length - 1] === base[base.length - 2]) {
        // 末尾双辅音 + ing，如 running → r+unning → 去一辅音 → run
        // 注意：避免误处理 "ing" 后的 ee/oo（meeting 中 t-ing 不重复）
        candidates.push(base.slice(0, -1))
      }
      // 加 e：making → make
      candidates.push(base + 'e')
      // 直接用 base
      candidates.push(base)
      return candidates
    },
  },
  // -ed 去 e / 双写还原
  {
    suffix: 'ed',
    transform: (base) => {
      const candidates: string[] = []
      // 双写辅音还原：stopped → stop
      if (base.length >= 2 && base[base.length - 1] === base[base.length - 2]) {
        candidates.push(base.slice(0, -1))
      }
      // 加 e：liked → like
      candidates.push(base + 'e')
      // 直接
      candidates.push(base)
      return candidates
    },
  },
  // -es 去 es （boxes → box, goes → go；但需在 IRREGULAR 优先）
  {
    suffix: 'es',
    transform: (base) => [base, base + 'e'], // boxes→box, goes→go(e)
  },
  // -s 去 s （books → book, cats → cat）
  {
    suffix: 's',
    transform: (base) => [base],
  },
  // -est → 原形/加 e
  {
    suffix: 'est',
    transform: (base) => [base + 'e', base],
  },
  // -er → 原形/加 e（bigger → big, larger → large）
  {
    suffix: 'er',
    transform: (base) => {
      const candidates: string[] = []
      // 双写还原：bigger → big
      if (base.length >= 2 && base[base.length - 1] === base[base.length - 2]) {
        candidates.push(base.slice(0, -1))
      }
      candidates.push(base + 'e', base)
      return candidates
    },
  },
  // -ly → 原形（quickly → quick）
  {
    suffix: 'ly',
    transform: (base) => {
      const candidates: string[] = [base]
      // happily → happy（y↔i）
      if (base.endsWith('i')) candidates.push(base.slice(0, -1) + 'y')
      // true → truly（去 e）
      candidates.push(base + 'e')
      return candidates
    },
  },
]

// ============================================================
// 主函数：生成候选列表
// ============================================================

/**
 * 词形还原：返回所有候选原形（含原词本身，按优先级排序）
 *
 * 不去重：上层 lookup 会逐个尝试并 break，重复无影响
 */
export function lemmatize(word: string): string[] {
  const w = word.trim().toLowerCase()
  if (!w) return []

  const candidates: string[] = [w]

  // 1. 不规则变换
  const irreg = IRREGULAR[w]
  if (irreg) candidates.push(...irreg)

  // 2. 后缀规则：按规则顺序匹配
  for (const rule of SUFFIX_RULES) {
    if (w.length > rule.suffix.length + 1 && w.endsWith(rule.suffix)) {
      const base = w.slice(0, w.length - rule.suffix.length)
      const transformed = rule.transform(base)
      candidates.push(...transformed)
    }
  }

  return candidates
}

/**
 * 判断是否为复合词（含连字符，如 long-term）
 */
export function isCompoundWord(word: string): boolean {
  const w = word.trim().toLowerCase()
  return w.includes('-') && /^[a-z]+(-[a-z]+)+$/.test(w)
}

/**
 * 拆分复合词：long-term → ['long', 'term']
 */
export function splitCompound(word: string): string[] {
  return word.trim().toLowerCase().split('-').filter(Boolean)
}
