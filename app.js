async function saveToFirestore(payload) {
    const doc = {
        createdAt: new Date(),
        raw: payload.raw, // 因子ごとのS_raw（-20〜+20）
        big5: payload.big5, // 0〜100のスコア
        z: payload.z, // zスコア
        type5: payload.type5, // ENFPU など
        answers: payload.answers, // 問題ごとの回答（-2〜+2）
        nickname: payload.nickname ?? null,
        respondentId: payload.respondentId ?? null,
        mbtiType: payload.mbtiType ?? null, // 16Personalitiesのタイプ（必須）
        version: "v1.0", // 質問票のバージョン管理用に任意で
    };

    try {
        await db.collection("diagnosisAnswers").add(doc);
        console.log("Saved");
    } catch (e) {
        console.error("保存エラー", e);
        alert(
            "データ保存時にエラーが発生しました。通信環境を確認してください。"
        );
    }
}

// URLパラメータから user を取得
const params = new URLSearchParams(location.search);
const respondentId = params.get("user") || null;

function shuffle(array) {
    return array
        .map((v) => ({ v, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ v }) => v);
}

const shuffled = shuffle(QUESTIONS);

const container = document.getElementById("questions-container");

shuffled.forEach((q, index) => {
    const div = document.createElement("div");

    // ← ここから追加
    div.classList.add("question");
    div.innerHTML = `
    <p class="question-text">
      <span class="question-number">${index + 1}.</span>${q.text}
    </p>
    <div class="options">
      <label class="option-label">
        <input type="radio" name="q${q.id}" value="-2">
        まったくそう思わない
      </label>
      <label class="option-label">
        <input type="radio" name="q${q.id}" value="-1">
        あまりそう思わない
      </label>
      <label class="option-label">
        <input type="radio" name="q${q.id}" value="0">
        どちらともいえない
      </label>
      <label class="option-label">
        <input type="radio" name="q${q.id}" value="1">
        そう思う
      </label>
      <label class="option-label">
        <input type="radio" name="q${q.id}" value="2">
        とてもそう思う
      </label>
    </div>
  `;
    // ← ここまでを div.innerHTML にセット

    container.appendChild(div);
});

const SIGMA = Math.sqrt(20);

// 境界 z
const THRESH = {
    EI: 0.1,
    SN: -0.29,
    TF: -0.49,
    JP: 0.28,
    AU: -0.25,
};

document.getElementById("quiz-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    // ★ ニックネーム取得（ここを追加）
    const nicknameInput = document.getElementById("nickname");
    const nickname = nicknameInput ? nicknameInput.value.trim() : null;

    // ★ 16Personalitiesのタイプ取得（必須）
    const mbtiInput = document.getElementById("mbtiType");
    let mbtiType = mbtiInput ? mbtiInput.value.trim() : "";

    // 入力チェック
    if (!mbtiType) {
        alert(
            "現在の16Personalitiesのタイプを入力してください。（例：INFJ-T）"
        );
        mbtiInput.focus();
        return;
    }

    // 大文字統一（enfj-a → ENFJ-A のように）
    mbtiType = mbtiType.toUpperCase();

    // 1) 因子ごとの raw スコア集計
    const raw = { E: 0, O: 0, C: 0, A: 0, N: 0 };
    const answers = {};

    for (const q of QUESTIONS) {
        const name = `q${q.id}`;
        const input = document.querySelector(`input[name="${name}"]:checked`);
        if (!input) {
            alert("全ての質問に回答してください。");
            return;
        }
        let value = Number(input.value); // -2〜+2
        answers[q.id] = value;

        if (q.direction === "-") {
            value = -value; // 逆転
        }
        raw[q.factor] += value;
    }

    // 2) 0〜100スコア
    const big5 = {};
    for (const key of ["E", "O", "C", "A", "N"]) {
        const s = raw[key];
        big5[key] = ((s + 20) / 40) * 100;
    }

    // 3) zスコア
    const z = {};
    for (const key of ["E", "O", "C", "A", "N"]) {
        z[key] = raw[key] / SIGMA;
    }

    // 4) 5文字タイプ判定
    const EI = z.E > THRESH.EI ? "E" : "I";
    const SN = z.O > THRESH.SN ? "N" : "S";
    const TF = z.A > THRESH.TF ? "F" : "T";
    const JP = z.C > THRESH.JP ? "J" : "P";
    const AU = z.N > THRESH.AU ? "U" : "A";
    const type5 = `${EI}${SN}${TF}${JP}${AU}`;

    // 5) 画面表示 → ★数値は見せず、メッセージだけにする
    const resultDiv = document.getElementById("result");
    resultDiv.innerHTML = `
    <h2>ご回答ありがとうございました</h2>
    <p>
      回答内容は、性格診断ロジックの研究・改善のためにのみ利用します。<br>
      今回のテスト版では、診断結果（スコアやタイプ）は表示せず、
      裏側で統計的に集計させていただきます。
    </p>
  `;

    //   // 5) 画面に表示
    //   const resultDiv = document.getElementById("result");
    //   resultDiv.innerHTML = `
    //   <h2>結果</h2>
    //   <p>外向性: ${big5.E.toFixed(1)}</p>
    //   <p>開放性: ${big5.O.toFixed(1)}</p>
    //   <p>誠実性: ${big5.C.toFixed(1)}</p>
    //   <p>調和性: ${big5.A.toFixed(1)}</p>
    //   <p>神経症: ${big5.N.toFixed(1)}</p>
    //   <p>タイプ: <strong>${type5}</strong></p>
    // `;

    // 6) Firestoreに保存
    await saveToFirestore({
        raw,
        big5,
        z,
        type5,
        answers,
        nickname,
        respondentId,
        mbtiType,
    });
});
