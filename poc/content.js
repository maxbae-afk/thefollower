'use strict';

/* =========================================================
   THE FOLLOWER — content
   Locations and creatures are data: add a bg + a clips.js and register them here.
   World space = the 1080x1920 stage at zoom 1. Kling frames are 1080x1912 source px.
   ========================================================= */

window.CONTENT = {
  locations: {
    haikyo: {
      name: '廃墟',
      bg: '../assets/locations/haikyo/bg.webp',
      backdrop: '../assets/locations/haikyo/backdrop.webp',   // 16:9, behind the stage on wide screens
      floorY: 1150,                 // world y where the creature's feet / claws touch the floor
      aim: [540, 1010],             // what the phone camera points at
      creatureTint: ['rgba(18, 26, 64, 0.38)', 'rgba(2, 4, 16, 0.62)'],   // top / bottom of the creature
      shadow: 0.55,
      light: { color: [120, 160, 255], amt: 0, period: 6 },   // the place's own light breathing over the room
      // streamer lines / chat lines that belong to this place, added to the shared decks and pools
      voice: { open: ['open_1'], early: ['early_3'] },
      chat: { standby: ['廃墟回きた', 'ここ有名なとこ?'], calm: ['水の音する', '奥のドア開いてる'] },
    },
    mori: {
      name: '夜の森',
      bg: '../assets/locations/mori/bg.webp',
      backdrop: '../assets/locations/mori/backdrop.webp',
      floorY: 1150,
      aim: [540, 1010],
      creatureTint: ['rgba(10, 34, 40, 0.42)', 'rgba(0, 8, 10, 0.66)'],
      shadow: 0.6,
      light: { color: [80, 255, 170], amt: 0.07, period: 7 },
      voice: { open: ['open_4'], early: ['early_6'] },
      chat: {
        standby: ['森回きた', '樹海?', '地元で有名なとこ', '夜の森は無理'],
        calm: ['お地蔵さん…', '赤い灯り何', '鳥の声しない', 'しめ縄…', 'お札だらけ'],
        scared: ['空気重い', '霧濃くなってない?'],
      },
    },
    byoin: {
      name: '隔離病棟',
      bg: '../assets/locations/byoin/bg.webp',
      backdrop: '../assets/locations/byoin/backdrop.webp',
      floorY: 1150,
      aim: [540, 1010],
      creatureTint: ['rgba(48, 8, 10, 0.4)', 'rgba(10, 0, 2, 0.66)'],
      shadow: 0.62,
      light: { color: [255, 24, 12], amt: 0.16, period: 2.4 },   // the emergency light
      voice: { open: ['open_5'], early: ['early_7'] },
      chat: {
        standby: ['病院回きた', '閉鎖病棟ってマジ?', '不法侵入では', '今日やばそう'],
        calm: ['拘束ベッド…', '壁の傷こわ', '赤いランプ', '奥の鉄格子', 'カルテ落ちてる'],
        scared: ['ドア開いてる…', '足音しない?'],
      },
    },
  },

  creatures: {
    onryo: {
      name: '怨霊',
      clips: 'CLIPS_onryo',         // window.<clips> from assets/creatures/<id>/clips.js
      dir: '../assets/creatures/onryo/',
      floorSrc: 1540,               // source-frame y of the floor contact
      scale: 0.36,                  // world px per source px
      idle: 'idle',
      // fake-outs: clip + the sounds that sell it
      tense: [
        { clip: 'tense_head', weight: 0.5, sfx: ['crack', 'sting'], sfxAt: [0.25, 0.3], line: 'face' },
        { clip: 'tense_reach', weight: 0.5, sfx: ['creak', 'whisper'], sfxAt: [0.15, 0.05], line: 'hand' },
      ],
      rise: { clip: 'rise', from: 6, rate: 2.2 },
      charge: { clip: 'charge', from: 8, rate: 1.55 },
      chat: { calm: ['うずくまってる', 'マネキン?', '髪長くない?'] },
    },
    kaisou: {
      name: '怪僧',
      clips: 'CLIPS_kaisou',
      dir: '../assets/creatures/kaisou/',
      floorSrc: 1530,
      scale: 0.4,
      idle: 'idle',
      tense: [
        { clip: 'tense_twist', weight: 0.5, sfx: ['crack', 'sting'], sfxAt: [0.2, 0.28], line: 'face' },
        { clip: 'tense_neck', weight: 0.5, sfx: ['creak', 'whisper'], sfxAt: [0.1, 0.2], line: 'neck' },
      ],
      rise: { clip: 'rise', from: 12, rate: 2.2 },     // lifted straight up as if on a string
      charge: { clip: 'charge', from: 40, rate: 1.5 }, // glides at the lens without walking
      chat: {
        calm: ['お坊さん?', '座ってる…', 'お経読んでる?', '顔にお札', '数珠…'],
        scared: ['お経聞こえる', 'ずっと祈ってる…'],
        panic: ['お経止まった', '立つな立つな'],
        neck: ['首!?', '首伸びた!!', 'ろくろ首…', 'ひっ', '無理無理無理', '今の見た!?', '首長すぎ'],
      },
    },
    kanja: {
      name: '患者',
      clips: 'CLIPS_kanja',
      dir: '../assets/creatures/kanja/',
      floorSrc: 1530,
      scale: 0.42,
      idle: 'idle',
      tense: [
        { clip: 'tense_snap', weight: 0.5, sfx: ['crack', 'sting'], sfxAt: [0.18, 0.26], line: 'face' },
        { clip: 'tense_crawl', weight: 0.5, sfx: ['creak', 'sting'], sfxAt: [0.1, 0.22], line: 'crawl' },
      ],
      rise: { clip: 'rise', from: 14, rate: 1.5 },     // yanked up like a puppet
      charge: { clip: 'charge', from: 30, rate: 1.6 }, // a frenzied, flailing sprint
      chat: {
        calm: ['人いる…', '患者さん?', 'しゃがんでる', '笑ってない?', '目が…'],
        scared: ['ずっとこっち見てる', '揺れてる…', 'ニヤニヤしてる'],
        panic: ['笑い声聞こえる', '目が合った…'],
        crawl: ['四つん這い!?', '来る来る来る', 'ひっ', 'え、動いた!!', '獣みたい', '無理無理無理'],
      },
    },
  },

  // the bet picks the tier: the more you put in, the worse the place and the thing in it.
  // fear: fake-out / static gaps (x), tremble (x), heart (+bpm), stage (how fast it turns scary), dark (vignette)
  tiers: [
    { minBet: 0, location: 'haikyo', creature: 'onryo',
      fear: { fakeGap: 1, glitchGap: 1, tremble: 1, heart: 0, stage: 1, dark: 0 } },
    { minBet: 20, location: 'mori', creature: 'kaisou',
      fear: { fakeGap: 0.82, glitchGap: 0.75, tremble: 1.2, heart: 8, stage: 0.85, dark: 0.14 } },
    { minBet: 100, location: 'byoin', creature: 'kanja',
      fear: { fakeGap: 0.66, glitchGap: 0.55, tremble: 1.45, heart: 16, stage: 0.7, dark: 0.26 } },
  ],

  // the streamer holding the phone (assets/audio/vo/<key>.mp3, script in tools/vo_lines.py); never subtitled
  voice: {
    dir: '../assets/audio/vo/',
    decks: {
      ready: ['ready_1', 'ready_2', 'ready_3', 'ready_4'],
      open: ['open_2', 'open_3'],
      early: ['early_1', 'early_2', 'early_4', 'early_5'],
      donate: ['donate_1', 'donate_2', 'donate_3'],
      mid: ['mid_1', 'mid_2', 'mid_3', 'mid_4', 'mid_5'],
      late: ['late_1', 'late_2', 'late_3', 'late_4', 'late_5', 'late_6'],
      fake_face: ['fake_face_1', 'fake_face_2'],
      fake_hand: ['fake_hand_1', 'fake_hand_2'],
      fake_neck: ['fake_neck_1'],
      fake_crawl: ['fake_crawl_1'],
      fake_glitch: ['fake_glitch_1', 'fake_glitch_2'],
      fake_any: ['fake_any_1', 'fake_any_2'],
      escape: ['escape_1', 'escape_2', 'escape_3', 'escape_4'],
      scream: ['scream_1', 'scream_2', 'scream_3', 'scream_4'],
      close: ['close_1', 'close_2'],
      climb: ['climb_1', 'climb_2'],
      retreat: ['retreat_1'],
    },
  },

  chat: {
    names: [
      'Yuki_777', 'DarkRaven', 'ねこまる', '夜更かし太郎', 'kuro_fan', '心霊マニア', 'ゆうれい部', 'まさと',
      'りな☆', 'ShadowFox', 'ばけねこ', '怖がりさん', '通りすがり', '深夜組', 'NightOwl', 'たまごかけ',
      'ひろし', 'mika_0213', 'KAGE', 'おばけ探偵', 'momo', '黒猫', '凸待ち', 'sora', '名無し', 'taku_ch',
      'アカネ', 'ぽんず', 'Haru', '影法師', '夜鳴き', 'やまと', 'kuroneko_99', 'しずく', 'GhostHunter',
      'まよなか', 'レイ', 'nana7', 'とうふ', '月見',
    ],
    colors: ['#9fd3ff', '#ffb3d1', '#ffe08a', '#a8f0b8', '#d4b8ff', '#ffc89a', '#8fe8e0', '#f5f5f5'],
    // by tension: the multiplier picks the pool
    pools: {
      standby: [
        'こんばんは〜', 'きた!', '待ってた', '今日どこ?', '初見です',
        '夜中に見るもんじゃない', 'わくわく', '寒そう', 'お疲れ様です', '通知から来た', '雰囲気やば', '画質いいね',
        '音量ちょうどいい', 'はよ始めて', '待機', '今日も生きて帰ってね',
      ],
      calm: [
        'こわ…', 'ライトつけて', '何か聞こえる?', 'なんかいない?', '奥…', '今の何', 'え、人?', '誰かいる',
        'ズームして', 'もっと近くで撮って!', '気のせい?', '鳥肌', 'やめとけって', '静かすぎ',
      ],
      scared: [
        'やばいやばい', '本物じゃん', 'えぐい…', '何これ…?', 'ガチでやばい', '近づいて!!', 'いや離れて',
        '息してる…', '音がする', '逃げて', '通報した方がいい', '見てるだけで怖い', '画面揺れてる', '手震えてるw',
        'ノイズやば', 'これ演出?', '演出じゃないって', 'マジで帰れ', 'こっち向いてない?',
      ],
      panic: [
        '逃げて!!!', 'もう無理', '早く!!', '死ぬぞ', 'まだ撮るの!?', '欲張るな', 'やめろおお', '今なら間に合う',
        'ヤバイヤバイヤバイ', 'うわあああ', '見ちゃダメ', '目が合った', '限界', '伝説回', '神回確定', '同接えぐい',
        '震え止まらん', 'もう帰って!!',
      ],
      face: ['今動いた!?', 'こっち見た!!', 'ひっ', 'うわっ', '顔見えた…', '心臓止まる', 'びびった', '無理無理無理'],
      hand: ['手!!手!!', '手伸ばしてる', 'ひっ', 'こっち来る?', 'やめてくれ', '指長すぎ', '今の見た!?', 'びびった'],
      glitch: ['ノイズ!?', '映像乱れた', '電波わる', '今なんか映った', 'え?', '止まった?', '戻った'],
      crash: ['あ', '逃げてえええ', 'うそ', '放送事故', 'え…', 'おい!!', '大丈夫!?', '通報して!!', 'ああああ', '立った'],
      escaped: ['ナイス判断!', '逃げた!', '賢い', '生きてて良かった', 'まだいけたのに', 'チキンw', '正解', 'おつ!', '命大事に'],
      // the stream moved somewhere else (tier change)
      moved: ['場所変わった!?', 'え、どこここ', 'ワープした?', '移動早w', 'ここやばくない?', '空気変わった'],
    },
    superchat: [
      'これで逃げて', 'もっと近くで!!', '神回!!', '生きて帰れ', '応援してる', 'ガチで本物?', '続けて!!',
      'ボーナス', '伝説を見せて', 'お守り代', 'もう一歩!', '震えた', '投げとく', 'チャンネル登録した',
    ],
  },
};
