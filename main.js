// LoRA（ローラ）リスト：必要に応じて編集
const LORA_LIST = [
  { label: "中村レグラ風", value: "<lora:Nakamura_Regura_Style_XL:0.8>" },
  { label: "プッシーリリー", value: "<lora:Pussy_Lily_v5_XL:0.6>" },
  { label: "高精細な瞳", value: "<lora:Eyes_High_Definition-00007:0.5>" },
  { label: "ヘアスタイル", value: "<lora:hair_style:0.4>" },
  { label: "制服セット", value: "<lora:school_uniform_XL:0.7>" },
  { label: "ランジェリーセット", value: "<lora:lingerie_XL:0.7>" },
  { label: "Pussyロッタ", value: "<lora:Pussy_Lotte_v6_XL_nf:0.7>" }
];

// 固定プロンプト
const FIXED_POSITIVE = {
  "2D": "(score_9), (score_8_up), (score_7_up), flat color, anime shading, clean line art",
  "2.5D": "(score_9), (score_8_up), (score_7_up), dslr, real human texture, soft focus, film grain, candid moment, subtle imperfections"
};
const FIXED_NEGATIVE = "(score_6), (score_5), (score_4), simplified, abstract, unrealistic, impressionistic, low_quality, bad_anatomy, extra_limbs";

// --- 読み込むファイル一覧（自動化できない場合は手動で列挙） ---
// characters/配下
const CHARACTER_JSON_LIST = [
  "characters/chitose_rio_albera_profile.json",
  "characters/fine_ophelia_character_profile.json",
  "characters/freyu_nemecia_complete_profile.json",
  "characters/hiyori_noir_character_profile.json",
  "characters/kinshima_haku_hyumina_profile.json",
  "characters/kotoha_lilith_character_profile.json",
  "characters/mina_rocca_mob_blacksmith_apprentice.json",
  "characters/noa_benne_complete_profile.json",
  "characters/saeki_enma_profile.json",
  "characters/serene_brahail_character_profile.json",
  "characters/tsubasa_kaguya_character_profile.json",
  "characters/valmia_nova_character_profile.json",
  "characters/yui_kardina_complete_profile.json"
];
// tags/配下
const TAGS_JSON_LIST = [
  "tags/background_location_tags.json",
  "tags/camera_angle_tags_nsfw.json",
  "tags/camera_effect_tags.json",
  "tags/expression_acting_tags_nsfw.json",
  "tags/fluids_tags_nsfw.json",
  "tags/mood_lighting_tags.json",
  "tags/pose_angle_tags_nsfw_extended.json"
];
// 状態
let CATEGORY_LIST = [];
let TAGS_DATA = {};
let selectedMode = "2D";
let selectedTags = [];
let selectedLora = [];

// ====== すべてのJSONをまとめて読み込み・統合 ======
async function loadAllJson() {
  // 1. キャラ系
  const charResults = await Promise.all(
    CHARACTER_JSON_LIST.map(f => fetch(f).then(r => r.json()))
  );
  // 2. 共通タグ系
  const tagResults = await Promise.all(
    TAGS_JSON_LIST.map(f => fetch(f).then(r => r.json()))
  );
  // 3. 合体
  let allCategories = [];
  let allTagsData = {};

  // キャラカテゴリ
  for (const charJson of charResults) {
    if (!charJson.transformation) continue;
    for (const item of charJson.transformation) {
      allCategories.push({ group: item.group, label: item.label });
      allTagsData[`${item.group}|${item.label}`] = item.tags;
    }
  }
  // 共通タグカテゴリ
  for (const tagJson of tagResults) {
    if (!tagJson.group || !tagJson.label || !tagJson.tags) continue;
    allCategories.push({ group: tagJson.group, label: tagJson.label });
    allTagsData[`${tagJson.group}|${tagJson.label}`] = tagJson.tags;
  }

  // 重複除去（同じgroup|labelは最初のみ採用）
  const seen = new Set();
  const CATEGORY_LIST = allCategories.filter(cat => {
    const key = `${cat.group}|${cat.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { CATEGORY_LIST, TAGS_DATA: allTagsData };
}

// ========== UI生成 ==========

function renderAccordion() {
  const accContainer = document.getElementById('accordion-container');
  accContainer.innerHTML = '';
  CATEGORY_LIST.forEach((cat, idx) => {
    // 見出し
    const catDiv = document.createElement('div');
    catDiv.className = 'cat-acc';
    const header = document.createElement('div');
    header.className = 'cat-header';
    header.innerHTML = `${cat.group}｜${cat.label} <span class="acc-arrow">&#9654;</span>`;
    header.onclick = () => {
      header.classList.toggle('open');
      content.classList.toggle('open');
    };
    // タグ部
    const tagKey = `${cat.group}|${cat.label}`;
    const tags = TAGS_DATA[tagKey] || [];
    const content = document.createElement('div');
    content.className = 'cat-content';
    tags.forEach((tag, i) => {
      const wrap = document.createElement('span');
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.id = `cat${idx}-tag${i}`;
      chk.value = tag.value;
      chk.checked = selectedTags.includes(tag.value);
      chk.onchange = () => {
        if (chk.checked) {
          if (!selectedTags.includes(tag.value)) selectedTags.push(tag.value);
        } else {
          selectedTags = selectedTags.filter(v => v !== tag.value);
        }
        updateAllPromptOutputs();
      };
      const lbl = document.createElement('label');
      lbl.htmlFor = chk.id;
      lbl.textContent = tag.label;
      wrap.appendChild(chk);
      wrap.appendChild(lbl);
      content.appendChild(wrap);
    });
    catDiv.appendChild(header);
    catDiv.appendChild(content);
    accContainer.appendChild(catDiv);
  });
  updateAllPromptOutputs();
}

// ===== LoRAチェックボックス生成 =====
function renderLoraCheckboxes() {
  const row = document.getElementById('lora-checkbox-row');
  row.innerHTML = "";
  LORA_LIST.forEach((item, idx) => {
    const lbl = document.createElement('label');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.value = item.value;
    chk.checked = selectedLora.includes(item.value);
    chk.onchange = () => {
      if (chk.checked) {
        if (!selectedLora.includes(item.value)) selectedLora.push(item.value);
      } else {
        selectedLora = selectedLora.filter(v => v !== item.value);
      }
      updateAllPromptOutputs();
    };
    const span = document.createElement('span');
    span.textContent = item.label;
    lbl.appendChild(chk);
    lbl.appendChild(span);
    row.appendChild(lbl);
  });
}

// ===== モード切替 =====
document.getElementById('mode-2d').onclick = () => {
  selectedMode = "2D";
  document.getElementById('mode-2d').classList.add('selected');
  document.getElementById('mode-2_5d').classList.remove('selected');
  updateAllPromptOutputs();
};
document.getElementById('mode-2_5d').onclick = () => {
  selectedMode = "2.5D";
  document.getElementById('mode-2_5d').classList.add('selected');
  document.getElementById('mode-2d').classList.remove('selected');
  updateAllPromptOutputs();
};

// ===== 出力更新 =====
function updateAllPromptOutputs() {
  let pos = FIXED_POSITIVE[selectedMode];
  if (selectedTags.length > 0) pos += ", " + selectedTags.join(", ");
  document.getElementById('positive-output').value = pos;
  document.getElementById('negative-output').value = FIXED_NEGATIVE;
  let loraStr = selectedLora.join(" ");
  let allStr = pos + "\n" + loraStr + "\n" + FIXED_NEGATIVE;
  document.getElementById('all-output').value = allStr;
}

// ===== コピー =====
function copyPositive() {
  navigator.clipboard.writeText(document.getElementById('positive-output').value);
}
function copyNegative() {
  navigator.clipboard.writeText(document.getElementById('negative-output').value);
}
function copyAllPrompt() {
  navigator.clipboard.writeText(document.getElementById('all-output').value);
}

// ===== プリセット =====
function savePreset() {
  const name = document.getElementById('preset-name').value.trim();
  if (!name) return alert("プリセット名を入力");
  const data = {
    mode: selectedMode,
    tags: selectedTags,
    lora: selectedLora
  };
  localStorage.setItem("prompt-preset-" + name, JSON.stringify(data));
  alert("保存しました");
}
function loadPreset() {
  const name = document.getElementById('preset-name').value.trim();
  if (!name) return alert("プリセット名を入力");
  const data = localStorage.getItem("prompt-preset-" + name);
  if (!data) return alert("プリセットが見つかりません");
  const parsed = JSON.parse(data);
  selectedMode = parsed.mode;
  document.getElementById('mode-2d').classList.toggle('selected', selectedMode==="2D");
  document.getElementById('mode-2_5d').classList.toggle('selected', selectedMode==="2.5D");
  selectedTags = parsed.tags || [];
  selectedLora = parsed.lora || [];
  renderAccordion();
  renderLoraCheckboxes();
  updateAllPromptOutputs();
}
function resetAll() {
  selectedMode = "2D";
  selectedTags = [];
  selectedLora = [];
  document.getElementById('preset-name').value = "";
  document.getElementById('mode-2d').classList.add('selected');
  document.getElementById('mode-2_5d').classList.remove('selected');
  renderAccordion();
  renderLoraCheckboxes();
  updateAllPromptOutputs();
}

// ===== 初期化 =====
window.addEventListener('DOMContentLoaded', async () => {
  const { CATEGORY_LIST: catList, TAGS_DATA: tagData } = await loadAllJson();
  CATEGORY_LIST = catList;
  TAGS_DATA = tagData;
  renderAccordion();
  renderLoraCheckboxes();
  updateAllPromptOutputs();
});
