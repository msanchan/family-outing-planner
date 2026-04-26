require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.post('/api/generate-plan', async (req, res) => {
  const { facility, transport, date, startTime } = req.body;

  if (!facility) {
    return res.status(400).json({ error: '施設名を入力してください' });
  }

  const transportText = transport === 'car' ? '車' : '公共交通機関（電車・バス）';
  const dateText = date || '今日';
  const startTimeText = startTime || '10:00';

  const prompt = `あなたは家族のお出かけプランを提案するアシスタントです。

以下の条件で、${dateText}の日帰りお出かけプランを提案してください。

【家族構成】
- パパ
- ママ
- 8歳の男の子

【メイン目的地】
${facility}

【移動手段】
${transportText}

【出発時刻】
${startTimeText}（自宅出発）

【帰宅時間】
23:00まで（余裕を持って22:30には最終地点を出発）

【必須条件】
1. メイン施設の前後に周辺で楽しめるスポット（公園・ゲームセンター・体験施設など）やカフェでのひと休みを取り入れること
2. 帰り道（メイン施設から帰宅途中）に夕食タイムを必ず設けること
3. 夕食はファミリーレストランやチェーン店（ガスト、デニーズ、ジョナサン、ビックリドンキー、からやま、丸亀製麺、サイゼリヤ、バーミヤン、ジョイフル、夢庵など）から選ぶこと
4. 8歳の男の子が楽しめる要素を必ず含めること
5. 各スポット間の移動時間も考慮すること

以下のJSON形式で回答してください（JSON以外のテキストは出力しないこと）：

{
  "title": "プランタイトル（魅力的な名前）",
  "summary": "プランの一言まとめ（50文字程度）",
  "transport": "${transportText}",
  "totalDistance": "総移動距離の目安（例：約50km）",
  "schedule": [
    {
      "time": "10:00",
      "type": "departure",
      "name": "自宅出発",
      "description": "お出かけスタート！",
      "duration": "移動中",
      "icon": "🚗",
      "tips": ""
    },
    {
      "time": "時刻",
      "type": "spot | cafe | meal | transit",
      "name": "スポット名",
      "description": "このスポットの説明（なぜここがおすすめか、何が楽しめるか）",
      "duration": "滞在時間（例：約2時間）",
      "icon": "絵文字",
      "tips": "お役立ちTips（駐車場情報・混雑時間・料金目安など）"
    }
  ],
  "totalCost": "家族3人の概算費用",
  "notes": ["注意点や持ち物リストなど（3〜5項目）"]
}

typeの値：
- departure: 出発
- spot: 観光・遊び場スポット
- cafe: カフェ・休憩スポット
- meal: 食事
- transit: 移動
- arrival: 帰宅

iconの選び方：
- 公園・自然系 → 🌳
- ゲーム・アトラクション → 🎮
- 水族館・動物園 → 🐠
- 博物館・科学館 → 🔬
- カフェ・スイーツ → ☕
- 食事（夕食） → 🍽️
- 移動（車） → 🚗
- 移動（電車） → 🚆
- ショッピング → 🛍️
- 出発・帰宅 → 🏠

スケジュールは最低6〜9個のアイテムを含めること。帰宅のアイテムも必ず追加すること。`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: 'あなたは日本の家族向けお出かけプランの専門家です。必ず有効なJSONのみを返してください。',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content[0].text.trim();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSONの解析に失敗しました');
    }

    const plan = JSON.parse(jsonMatch[0]);
    res.json({ success: true, plan });
  } catch (error) {
    console.error('Error generating plan:', error);
    if (error instanceof SyntaxError) {
      res.status(500).json({ error: 'プランの生成中にエラーが発生しました。もう一度お試しください。' });
    } else {
      res.status(500).json({ error: error.message || 'プランの生成に失敗しました' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 家族お出かけプランナー起動中: http://localhost:${PORT}`);
});
