const capturedErrors = [];
const errorLog = document.querySelector("#errorLog");
function captureError(error, context = "JavaScript") {
  const details = error instanceof Error ? (error.stack || error.message) : String(error);
  capturedErrors.unshift(`[${new Date().toLocaleTimeString("pt-BR")}] ${context}\n${details}`);
  errorLog.textContent = capturedErrors.join("\n\n") || "Nenhum erro capturado ainda.";
}
window.addEventListener("error", (event) => captureError(event.error || event.message, "Erro não tratado"));
window.addEventListener("unhandledrejection", (event) => captureError(event.reason, "Promise rejeitada"));

document.querySelector("#openErrorModal").addEventListener("click", () => document.querySelector("#errorDialog").showModal());
document.querySelector("#clearErrorLog").addEventListener("click", () => { capturedErrors.length = 0; errorLog.textContent = "Nenhum erro capturado ainda."; });
document.querySelector("#copyErrorLog").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(errorLog.textContent); } catch (error) { captureError(error, "Cópia do log"); }
});

let initializeApp, getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy;
try {
  ({ initializeApp } = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"));
  ({ getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"));
} catch (error) {
  captureError(error, "Carregamento do Firebase");
  throw error;
}

const firebaseConfig = {
  apiKey: "AIzaSyDdjJzIrB9LvsIq9zLNUf36ajxacl5KZ9U",
  authDomain: "nossa-casa-9d12f.firebaseapp.com",
  projectId: "nossa-casa-9d12f",
  storageBucket: "nossa-casa-9d12f.firebasestorage.app",
  messagingSenderId: "760295708350",
  appId: "1:760295708350:web:acf09a31d6a715c134f0ef",
  measurementId: "G-K6BW82EPXZ"
};

const db = getFirestore(initializeApp(firebaseConfig));
const $ = (selector) => document.querySelector(selector);
const els = {
  budgetTotal: $("#budgetTotal"), spentTotal: $("#spentTotal"), progressFill: $("#progressFill"), progressText: $("#progressText"),
  pendingCount: $("#pendingCount"), boughtCount: $("#boughtCount"), filters: $("#categoryFilters"), items: $("#itemsList"), empty: $("#emptyState"),
  itemDialog: $("#itemDialog"), itemForm: $("#itemForm"), itemId: $("#itemId"), itemName: $("#itemName"), itemCategory: $("#itemCategory"), itemPriority: $("#itemPriority"), itemValue: $("#itemValue"), itemLink: $("#itemLink"), itemBought: $("#itemBought"), itemSearch: $("#itemSearch"),
  categoryDialog: $("#categoryDialog"), categoryForm: $("#categoryForm"), categoryName: $("#categoryName"), categoryManager: $("#categoryManager"), toast: $("#toast")
};
let items = [], categories = [], activeCategory = "all";
const priorities = { necessary: { label: "Necessário", order: 0 }, before_move: { label: "Antes da mudança", order: 1 }, after_move: { label: "Depois da mudança", order: 2 } };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => els.toast.classList.remove("show"), 2800);
}
function valueFromInput(value) {
  const normalized = String(value).trim().replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", ".");
  return Number(normalized) || 0;
}
function formatInput(value) { return value ? money.format(value).replace("R$", "").trim() : ""; }
function escapeHtml(value = "") { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }
function itemCategoryName(item) { return categories.find((category) => category.id === item.categoryId)?.name || "Sem categoria"; }
function itemPriority(item) { return priorities[item.priority] || priorities.necessary; }

function render() {
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const spent = items.filter((item) => item.bought).reduce((sum, item) => sum + Number(item.value || 0), 0);
  const purchased = items.filter((item) => item.bought).length;
  const progress = total ? Math.round((spent / total) * 100) : 0;
  els.budgetTotal.textContent = money.format(total); els.spentTotal.textContent = money.format(spent);
  els.progressFill.style.width = `${progress}%`; els.progressText.textContent = `${progress}% concluído`;
  els.pendingCount.textContent = items.length - purchased; els.boughtCount.textContent = purchased;
  els.filters.innerHTML = `<button class="filter ${activeCategory === "all" ? "active" : ""}" data-category="all">Todos <b>${items.length}</b></button>` + categories.map((category) => `<button class="filter ${activeCategory === category.id ? "active" : ""}" data-category="${category.id}">${escapeHtml(category.name)} <b>${items.filter((item) => item.categoryId === category.id).length}</b></button>`).join("");
  const search = els.itemSearch.value.trim().toLocaleLowerCase("pt-BR");
  const filtered = items
    .filter((item) => activeCategory === "all" || item.categoryId === activeCategory)
    .filter((item) => !search || item.name.toLocaleLowerCase("pt-BR").includes(search) || itemCategoryName(item).toLocaleLowerCase("pt-BR").includes(search))
    .sort((a, b) => itemPriority(a).order - itemPriority(b).order);
  els.items.innerHTML = filtered.map((item) => `<article class="item-card ${item.bought ? "is-bought" : ""}">
    <button class="status-button" data-toggle="${item.id}" aria-label="${item.bought ? "Marcar como não comprado" : "Marcar como comprado"}">${item.bought ? "✓" : ""}</button>
    <div class="item-body"><div class="item-name">${escapeHtml(item.name)}</div><div class="item-meta"><span class="category-pill">${escapeHtml(itemCategoryName(item))}</span><span class="priority-pill priority-${item.priority || "necessary"}">${itemPriority(item).label}</span>${item.link ? `<a class="item-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener" aria-label="Abrir produto ${escapeHtml(item.name)} em uma nova aba"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 13.5a4 4 0 0 0 5.66.08l2-2a4 4 0 0 0-5.66-5.66l-1.15 1.15M13.5 10.5a4 4 0 0 0-5.66-.08l-2 2a4 4 0 0 0 5.66 5.66l1.14-1.14"/></svg><span>Ver produto</span><svg class="external-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg></a>` : ""}</div></div>
    <span class="item-value">${money.format(item.value)}</span><button class="item-menu" data-edit="${item.id}" aria-label="Editar ${escapeHtml(item.name)}">⋮</button>
  </article>`).join("");
  els.empty.hidden = filtered.length !== 0;
}

function renderCategoryOptions(selected = "") {
  els.itemCategory.innerHTML = categories.map((category) => `<option value="${category.id}" ${category.id === selected ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("");
}
function renderCategoryManager() {
  els.categoryManager.innerHTML = categories.length ? categories.map((category) => `<div class="category-row"><span>${escapeHtml(category.name)}</span><button type="button" class="delete-category" data-delete-category="${category.id}">Excluir</button></div>`).join("") : `<p class="empty-categories">Crie sua primeira categoria.</p>`;
}
function openItem(item) {
  if (!categories.length) { showToast("Crie uma categoria antes de adicionar itens."); els.categoryDialog.showModal(); return; }
  els.itemForm.reset(); els.itemId.value = item?.id || "";
  $("#itemDialogEyebrow").textContent = item ? "EDITAR ITEM" : "NOVO ITEM";
  $("#itemDialogTitle").textContent = item ? "Atualize os detalhes" : "Adicionar à lista";
  els.itemName.value = item?.name || ""; renderCategoryOptions(item?.categoryId || categories[0].id);
  els.itemPriority.value = item?.priority || "necessary"; els.itemValue.value = item ? formatInput(item.value) : ""; els.itemLink.value = item?.link || ""; els.itemBought.checked = item?.bought || false;
  els.itemDialog.showModal(); els.itemName.focus();
}

async function createCategory(name) {
  const cleanName = name.trim();
  if (!cleanName) return;
  if (categories.some((category) => category.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) { showToast("Essa categoria já existe."); return; }
  await addDoc(collection(db, "categories"), { name: cleanName, createdAt: Date.now() });
  els.categoryName.value = ""; showToast("Categoria criada.");
}
function subscribe() {
  onSnapshot(query(collection(db, "categories"), orderBy("createdAt", "asc")), async (snapshot) => {
    categories = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    if (!categories.length) await Promise.all(["Sala", "Quarto", "Cozinha"].map((name, index) => addDoc(collection(db, "categories"), { name, createdAt: Date.now() + index })));
    renderCategoryOptions(); renderCategoryManager(); render();
  }, () => showToast("Não foi possível carregar as categorias do Firebase."));
  onSnapshot(query(collection(db, "items"), orderBy("createdAt", "desc")), (snapshot) => {
    items = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); render();
  }, () => showToast("Não foi possível carregar os itens do Firebase."));
}

$("#openItemModal").addEventListener("click", () => openItem()); $("#emptyAdd").addEventListener("click", () => openItem());
$("#manageCategories").addEventListener("click", () => { renderCategoryManager(); els.categoryDialog.showModal(); });
$("#newCategoryFromItem").addEventListener("click", () => els.categoryDialog.showModal());
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => $("#" + button.dataset.close).close()));
els.itemValue.addEventListener("blur", () => { const value = valueFromInput(els.itemValue.value); if (value) els.itemValue.value = formatInput(value); });
els.itemForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const payload = { name: els.itemName.value.trim(), categoryId: els.itemCategory.value, priority: els.itemPriority.value, value: valueFromInput(els.itemValue.value), link: els.itemLink.value.trim(), bought: els.itemBought.checked };
  if (!payload.name || !payload.value) { showToast("Informe um nome e um valor válido."); return; }
  try { if (els.itemId.value) await updateDoc(doc(db, "items", els.itemId.value), payload); else await addDoc(collection(db, "items"), { ...payload, createdAt: Date.now() }); els.itemDialog.close(); showToast("Item salvo na sua lista."); } catch { showToast("Não foi possível salvar no Firebase."); }
});
els.categoryForm.addEventListener("submit", async (event) => { event.preventDefault(); try { await createCategory(els.categoryName.value); } catch { showToast("Não foi possível criar a categoria."); } });
els.filters.addEventListener("click", (event) => { const button = event.target.closest("[data-category]"); if (button) { activeCategory = button.dataset.category; render(); } });
els.itemSearch.addEventListener("input", render);
els.items.addEventListener("click", async (event) => { const toggle = event.target.closest("[data-toggle]"), edit = event.target.closest("[data-edit]"); try { if (toggle) { const item = items.find((entry) => entry.id === toggle.dataset.toggle); await updateDoc(doc(db, "items", item.id), { bought: !item.bought }); } if (edit) openItem(items.find((entry) => entry.id === edit.dataset.edit)); } catch { showToast("Não foi possível atualizar o item."); } });
els.categoryManager.addEventListener("click", async (event) => { const button = event.target.closest("[data-delete-category]"); if (!button) return; const categoryId = button.dataset.deleteCategory; if (items.some((item) => item.categoryId === categoryId)) { showToast("Mova os itens desta categoria antes de excluí-la."); return; } try { await deleteDoc(doc(db, "categories", categoryId)); if (activeCategory === categoryId) activeCategory = "all"; showToast("Categoria excluída."); } catch { showToast("Não foi possível excluir a categoria."); } });
subscribe();
