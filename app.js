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
        version: "v1.1", // 60人基準でキャリブレーション済みロジック(2025/12/12)
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
// URLパラメータから user / from を取得
const params = new URLSearchParams(location.search);
const respondentId = params.get("user") || null;
const from = params.get("from") || null;

// 「アカウント表示名」ラベルを出し分け
const nicknameLabelEl = document.getElementById("nickname-label");
if (nicknameLabelEl) {
    let labelText = "アカウント表示名"; // デフォルト

    if (from === "croudia" || from === "craudia") {
        labelText = "クラウディア表示名";
    } else if (from === "crowdworks") {
        labelText = "クラウドワークス表示名";
    } else if (from === "shufti" || from === "shufty") {
        labelText = "シュフティ表示名";
    }

    nicknameLabelEl.textContent = labelText;
}

function shuffle(array) {
    return array
        .map((v) => ({ v, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ v }) => v);
}

// const shuffled = shuffle(QUESTIONS);　一次的にコメントアウト
const questionList = QUESTIONS;

const container = document.getElementById("questions-container");

const submitBtn = document.getElementById("submit-btn");
const quizArea = document.getElementById("quiz-area");
const thanksArea = document.getElementById("thanks-area");

// ★ 60人分のデータから計算した「rawスコア」の平均(μ)と標準偏差(σ)
const MEAN = {
    E: -4.466666667, // raw_E の平均
    O: 2.883333333, // raw_O の平均
    C: 4.2, // raw_C の平均
    A: 0.65, // raw_A の平均
    N: 4.183333333, // raw_N の平均
};

const SIGMA = {
    E: 8.83841129, // raw_E の標準偏差
    O: 6.279079244, // raw_O の標準偏差
    C: 6.456635005, // raw_C の標準偏差
    A: 4.576376333, // raw_A の標準偏差
    N: 7.393289827, // raw_N の標準偏差
};

// shuffled.forEach((q, index) => {     一次的にコメントアウト
questionList.forEach((q, index) => {
    const div = document.createElement("div");

    div.classList.add("question");
    // ★ 追加：テキスト内の \n を <br> に変換
    const textHtml = q.text.replace(/\n/g, "<br>");

    div.innerHTML = `
    <div class="question-row">
    <span class="question-number">${index + 1}.</span>
    <p class="question-text">${textHtml}</p>
  </div>

  <div class="options">
    <label class="option-label">
      <input type="radio" name="q${q.id}" value="-2"> まったくそう思わない
    </label>
    <label class="option-label">
      <input type="radio" name="q${q.id}" value="-1"> あまりそう思わない
    </label>
    <label class="option-label">
      <input type="radio" name="q${q.id}" value="0"> どちらともいえない
    </label>
    <label class="option-label">
      <input type="radio" name="q${q.id}" value="1"> そう思う
    </label>
    <label class="option-label">
      <input type="radio" name="q${q.id}" value="2"> とてもそう思う
    </label>
  </div>
`;

    container.appendChild(div);
});

// 境界 z
const THRESH = {
    EI: 0.65,
    SN: -0.29,
    TF: -0.2,
    JP: 0.25,
    AU: -0.25,
};

document.getElementById("quiz-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    // ★ 二重送信防止
    submitBtn.disabled = true;
    submitBtn.textContent = "送信中...";

    try {
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
            submitBtn.disabled = false;
            submitBtn.textContent = "結果を送信する";
            return;
        }

        // 大文字統一（enfj-a → ENFJ-A のように）
        mbtiType = mbtiType.toUpperCase();

        // 1) 因子ごとの raw スコア集計
        const raw = { E: 0, O: 0, C: 0, A: 0, N: 0 };
        const answers = {};
        

        for (const q of QUESTIONS) {
            const name = `q${q.id}`;
            const input = document.querySelector(
                `input[name="${name}"]:checked`
            );
            if (!input) {
                alert("全ての質問に回答してください。");
                submitBtn.disabled = false;
                submitBtn.textContent = "結果を送信する";
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

        // 3) zスコア（平均補正あり： z = (raw - μ) / σ）
        const z = {};
        for (const key of ["E", "O", "C", "A", "N"]) {
            // MEAN[key], SIGMA[key] は上で定義したオブジェクトから参照
            z[key] = (raw[key] - MEAN[key]) / SIGMA[key];
        }

        // 4) 5文字タイプ判定
        const EI = z.E > THRESH.EI ? "E" : "I";
        const SN = z.O > THRESH.SN ? "N" : "S";
        const TF = z.A > THRESH.TF ? "F" : "T";
        const JP = z.C > THRESH.JP ? "J" : "P";
        const AU = z.N > THRESH.AU ? "U" : "A";
        const type5 = `${EI}${SN}${TF}${JP}${AU}`;

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

        // 6) 送信完了 → 質問エリアを隠してサンクス画面を表示
        quizArea.classList.add("hidden");
        thanksArea.classList.remove("hidden");
    } catch (err) {
        console.error("保存エラー", err);
        alert(
            "送信中にエラーが発生しました。通信環境を確認して、もう一度お試しください。"
        );
        submitBtn.disabled = false;
        submitBtn.textContent = "結果を送信する";
    }
});
