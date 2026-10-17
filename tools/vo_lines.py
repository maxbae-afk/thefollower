"""The streamer's lines (Higgsfield Eleven v4, preset voice "Miles"). Never shown on screen.

key -> (direction tag + Japanese line). The deck is the key without its trailing number;
poc/content.js lists the same keys per deck.
"""
VOICE_ID = 'e18664a7-ee4f-5273-acf8-533eb24cd366'
STABILITY = 0.3

LINES = {
    # between rounds, the stream on standby
    'ready_1': '[cocky, casual] よし、次いくぞ〜。みんなちゃんと見とけよ？',
    'ready_2': '[defensive, half laughing] はい再開〜。さっきのは演出じゃないからな？マジで。',
    'ready_3': '[hyped] 視聴者、まだまだ増やすぞ〜。拡散よろ！',
    'ready_4': '[quietly, steeling himself] …よし。電池まだいける。行くか。',
    # first words of a round
    'open_1': '[cocky, energetic] はいどーも！クロライブの時間だぜ〜。今日はガチの廃墟、来ちゃいました！',
    'open_2': '[cocky, energetic] 配信スタート！今日こそ本物、撮ってやるからな〜。',
    'open_3': '[hushed but excited] はい、ライブ入りました〜。ここ、マジで出るらしいっすよ。',
    'open_4': '[hushed, excited] はいどーも、クロライブ。今日は…夜の森です。地元の人も、絶対入らないってとこ。',
    'open_5': '[whispering, tense excitement] …ライブ入りました。ここ、閉鎖病棟です。マジで入っちゃダメなとこ。',
    # filming: cocky, then uneasy, then scared
    'early_1': '[smug, laughing] え？ビビってる？ ビビってねーし！ 余裕っしょ、余裕。',
    'early_2': '[annoyed, laughing] コメ欄うるせーな、大丈夫だって。',
    'early_3': '[smug, bored] てか、ただの廃墟じゃん。なんもいねーよ。',
    'early_4': '[delighted, cocky] うわ、視聴者めっちゃ増えてる！みんな暇かよ〜。',
    'early_5': '[mocking] 心霊とか、全部気のせいなんだって。',
    'early_6': '[smug, a little uneasy] 森なんて、ただ暗いだけだし。…てか、虫の声もしねーな。',
    'early_7': '[nervous laugh, forcing it] 患者さんとか…もういないよな？…いないよな？',
    'donate_1': '[cheerful, cocky] おっ、投げ銭あざーっす！ もっと奥行けって？ しゃーねーなぁ。',
    'donate_2': '[excited] うおっ、スパチャきた！あざっす！',
    'donate_3': '[cheerful, then uneasy] 投げ銭サンキュー！…え、もっと近づけ？マジで言ってる？',
    'mid_1': '[nervous whisper] ……今の音、なに？ ちょ、みんな静かにして……',
    'mid_2': '[uneasy, quiet] …なんか、寒くね？急に。',
    'mid_3': '[nervous, reading chat] みんな、後ろって何？…後ろ、なんもないよな…？',
    'mid_4': '[forcing confidence, shaky] …いや、大丈夫。大丈夫だって。…たぶん。',
    'mid_5': '[nervous laugh, trembling] ちょ、カメラ揺れんな…手、震えてんだけど。',
    'late_1': '[scared, trembling, shaky breath] やばい、やばいって……マジでなんかいる……早く逃げた方がいいかな……',
    'late_2': '[scared, torn] もう帰ろうかな…いや、でも同接が…',
    'late_3': '[heavy breathing, terrified] はぁ…はぁ…心臓やばい…',
    'late_4': '[whispering, terrified] …あれ、さっきより近くね…？',
    'late_5': '[desperate whisper] 頼む…動くなよ…動くなよ…',
    'late_6': '[scared but greedy] マジで無理…でも、あとちょっとだけ…',
    # a fake-out lands
    'fake_face_1': '[panicking, terrified] 無理無理無理！ こっち見てる……！ 見てるって！',
    'fake_face_2': '[gasping, shocked] うわっ！？今、顔…顔上げた…！',
    'fake_hand_1': '[shocked, terrified] て、手が…手が伸びてる…！？',
    'fake_hand_2': '[terrified whisper] …今、指…動いたよな…？',
    'fake_glitch_1': '[panicked] うわっ、ちょ、カメラ壊れた！？',
    'fake_glitch_2': '[nervous, annoyed] おい…ノイズやばいって…電波わりぃな…',
    'fake_neck_1': '[terrified, disbelieving] く、首…首が伸びてる…！？',
    'fake_crawl_1': '[panicking] うわっ、来る来る来るっ！…と、止まった…？',
    'fake_any_1': '[sharp gasp, terrified] ひっ…！な、なに今の…',
    'fake_any_2': '[shaky, disbelieving] おいおいおい…嘘だろ…',
    # the player cashes out / it attacks / it attacks after you got out
    'escape_1': '[out of breath, relieved] はぁ……はぁ……セーフ……マジで死ぬかと思った……',
    'escape_2': '[panicked, shouting] むりむり！もう帰る！帰るって！',
    'escape_3': '[out of breath, cocky laugh] 勝ち逃げ〜！へへっ、みんな見たか？',
    'escape_4': '[running, panicked, out of breath] 逃げろ逃げろ逃げろっ！',
    'scream_1': '[screaming in terror] うわああああああっ！！ 来るな、来るなああっ！！',
    'scream_2': '[blood-curdling scream] ぎゃああああっ！！ いやだああっ！！',
    'scream_3': '[screaming, desperate] やめろ、やめろおおおっ！！',
    'scream_4': '[screaming, choking] うああっ…！た、助け…っ！',
    'close_1': '[shaky, relieved whisper] …あっぶね…マジで逃げてよかった…',
    'close_2': '[stunned, quiet] え…配信、切れた…？俺、まだあそこにいたら…',
    # the player moves the bet into another tier, between rounds
    'climb_1': '[excited, nervous] よっしゃ、場所変えるぞ。もっとヤバいとこ行ってみよう。',
    'climb_2': '[uneasy but hyped] …マジで行く？ここ、ガチなとこだぞ…',
    'retreat_1': '[relieved laugh] …ちょっと戻るわ。さすがにあそこは無理。',
    # chat throws a koban in (a spin of the 除霊 bonus)
    'koban_1': '[surprised, delighted] おっ、小判きた！ありがと！',
    'koban_2': '[excited, nervous laugh] また小判！？お祓い代かよ、これ…',
    'koban_3': '[hushed, hyped] 小判…！よし、まだいける…',
    # the 除霊 bonus, after the escape
    'bonus_1': '[out of breath, fired up] よし…みんなの小判で、こいつはらってやる！',
    'bonus_2': '[hyped, shouting] 除霊タイムだ！いっけえ！',
    'hit_1': '[excited] 効いてる効いてる！',
    'hit_2': '[shouting, hyped] うおっ、でかいの入った！',
    'hit_3': '[fired up] いけいけいけ！',
    'exorcise_1': '[ecstatic, shouting] 除霊成功ーっ！！',
    'exorcise_2': '[stunned, then overjoyed] 消えた…マジではらえた！やったぁ！',
    'fail_1': '[frustrated, out of breath] くそっ、しぶといな…',
    'fail_2': '[disappointed, laughing it off] あとちょっとだったのに…次ははらう。',
}

# audition takes already recorded with this voice (assets/src/voice_takes/C_miles/)
REUSED = {
    'early_1': 'chat', 'donate_1': 'donate', 'mid_1': 'listen',
    'late_1': 'scared', 'fake_face_1': 'panic', 'scream_1': 'scream', 'escape_1': 'relief',
}
