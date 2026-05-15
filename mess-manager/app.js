const LOCAL_STATE_KEY = "mess-manager-local-state-v2";
const LOCAL_AUTH_KEY = "mess-manager-local-auth-v2";
const OWNER_EMAIL = (window.MESS_OWNER_EMAIL || "shazidsaharia21@gmail.com").toLowerCase();

const today = new Date();
const isoDate = today.toISOString().slice(0, 10);
const isoMonth = isoDate.slice(0, 7);

const state = {
  month: isoMonth,
  settings: {
    breakfastWeight: 0.5,
    lunchWeight: 1,
    dinnerWeight: 1,
    fixedMeal: 50,
    zeroMealMinimum: 25,
  },
  users: [],
  members: [],
  meals: {},
  payments: [],
  expenses: [],
  bazar: [],
};

const editing = {
  memberId: "",
  paymentId: "",
  expenseId: "",
  bazarId: "",
};

let currentAuthUser = null;
let firebaseEnabled = false;
let db = null;
let authProvider = null;
let unsubscribers = [];

function hasFirebaseConfig() {
  const config = window.MESS_FIREBASE_CONFIG || {};
  return Boolean(config.apiKey && config.authDomain && config.projectId && window.firebase);
}

function emailKey(email) {
  return email.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

function localId() {
  return crypto.randomUUID();
}

function money(value) {
  return `Tk ${Math.round(Number(value || 0)).toLocaleString("en-BD")}`;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isGmail(email) {
  return /^[^\s@]+@gmail\.com$/i.test(email);
}

function currentUser() {
  if (!currentAuthUser) return null;
  return state.users.find((user) => user.email === currentAuthUser.email) || null;
}

function currentRole() {
  const user = currentUser();
  if (!currentAuthUser) return "member";
  if (currentAuthUser.email === OWNER_EMAIL) return "owner";
  return user?.role || "member";
}

function isOwner() {
  return currentRole() === "owner";
}

function canEditData() {
  return ["owner", "manager"].includes(currentRole()) && !currentUser()?.blocked;
}

function canEditRoles() {
  return isOwner();
}

function requireDataPower() {
  if (canEditData()) return true;
  alert("Only owner or manager can add/edit/delete data.");
  return false;
}

function requireOwner() {
  if (isOwner()) return true;
  alert("Only owner can change roles or block/unblock Gmail.");
  return false;
}

function collectionName(name) {
  return `mess_${name}`;
}

async function initFirebase() {
  if (!hasFirebaseConfig()) return false;
  firebase.initializeApp(window.MESS_FIREBASE_CONFIG);
  db = firebase.firestore();
  authProvider = new firebase.auth.GoogleAuthProvider();
  firebaseEnabled = true;
  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      currentAuthUser = null;
      renderAuth();
      return;
    }
    const email = normalizeEmail(user.email);
    currentAuthUser = {
      uid: user.uid,
      email,
      name: user.displayName || email.split("@")[0],
    };
    await ensureUser(currentAuthUser);
    subscribeDatabase();
  });
  return true;
}

async function ensureUser(user) {
  if (!firebaseEnabled) {
    const localAuth = loadLocalAuth();
    currentAuthUser = user;
    let existing = localAuth.users.find((item) => item.email === user.email);
    if (!existing) {
      existing = {
        id: emailKey(user.email),
        email: user.email,
        name: user.name,
        role: user.email === OWNER_EMAIL ? "owner" : "member",
        blocked: false,
      };
      localAuth.users.push(existing);
      saveLocalAuth(localAuth);
    }
    state.users = localAuth.users;
    syncSignedUserMember(existing);
    return;
  }

  const ref = db.collection(collectionName("users")).doc(user.uid || emailKey(user.email));
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      email: user.email,
      name: user.name,
      role: user.email === OWNER_EMAIL ? "owner" : "member",
      blocked: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } else if (user.email === OWNER_EMAIL && snap.data().role !== "owner") {
    await ref.update({ role: "owner", blocked: false });
  }

  const memberRef = db.collection(collectionName("members")).doc(user.uid || emailKey(user.email));
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    await memberRef.set({
      email: user.email,
      name: user.name,
      phone: "",
      active: true,
      serial: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }
}

function loadLocalState() {
  const saved = localStorage.getItem(LOCAL_STATE_KEY);
  if (!saved) return;
  Object.assign(state, JSON.parse(saved));
}

function saveLocalState() {
  localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
}

function loadLocalAuth() {
  const saved = localStorage.getItem(LOCAL_AUTH_KEY);
  if (saved) return JSON.parse(saved);
  return { users: [] };
}

function saveLocalAuth(data) {
  localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(data));
}

function syncSignedUserMember(user) {
  if (!state.members.some((member) => member.email === user.email)) {
    state.members.push({
      id: emailKey(user.email),
      email: user.email,
      name: user.name || user.email.split("@")[0],
      phone: "",
      active: true,
      serial: state.members.length + 1,
    });
    saveLocalState();
  }
}

function subscribeDatabase() {
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers = [];

  const bind = (name, assign) => {
    const unsubscribe = db.collection(collectionName(name)).onSnapshot((snapshot) => {
      assign(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      if (name === "users") {
        const signedUser = state.users.find((user) => user.email === currentAuthUser?.email);
        if (signedUser?.blocked) {
          alert("Your Gmail is blocked by owner.");
          firebase.auth().signOut();
          return;
        }
      }
      renderAuth();
    });
    unsubscribers.push(unsubscribe);
  };

  bind("users", (rows) => {
    state.users = rows.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  });
  bind("members", (rows) => {
    state.members = rows.sort((a, b) => Number(a.serial || 0) - Number(b.serial || 0));
  });
  bind("payments", (rows) => {
    state.payments = rows.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  });
  bind("expenses", (rows) => {
    state.expenses = rows.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  });
  bind("bazar", (rows) => {
    state.bazar = rows.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  });
  db.collection(collectionName("meals")).onSnapshot((snapshot) => {
    const meals = {};
    snapshot.docs.forEach((doc) => {
      meals[doc.id] = doc.data().entries || {};
    });
    state.meals = meals;
    renderAuth();
  });
}

async function saveDoc(collection, id, payload) {
  if (!firebaseEnabled) {
    const list = state[collection];
    const index = list.findIndex((item) => item.id === id);
    if (index >= 0) list[index] = { id, ...payload };
    else list.push({ id, ...payload });
    saveLocalState();
    renderAll();
    return;
  }
  await db.collection(collectionName(collection)).doc(id).set(payload, { merge: true });
}

async function deleteDoc(collection, id) {
  if (!firebaseEnabled) {
    state[collection] = state[collection].filter((item) => item.id !== id);
    saveLocalState();
    renderAll();
    return;
  }
  await db.collection(collectionName(collection)).doc(id).delete();
}

async function saveMealDate(date, entries) {
  state.meals[date] = entries;
  if (!firebaseEnabled) {
    saveLocalState();
    renderAll();
    return;
  }
  await db.collection(collectionName("meals")).doc(date).set({ entries });
}

function rowActions(type, id) {
  if (type === "role" && !canEditRoles()) return "";
  if (type !== "role" && !canEditData()) return "";
  return `<div class="row-actions">
    <button type="button" class="edit-btn" data-type="${type}" data-id="${id}">Edit</button>
    <button type="button" class="danger delete-btn" data-type="${type}" data-id="${id}">Delete</button>
  </div>`;
}

function setEditing(type, id = "") {
  editing[`${type}Id`] = id;
  const submit = document.getElementById(`${type}SubmitBtn`);
  const cancel = document.getElementById(`${type}CancelBtn`);
  if (submit) submit.textContent = id ? `Update ${type}` : `Add ${type === "payment" ? "joma" : type}`;
  if (cancel) cancel.classList.toggle("hidden", !id);
}

function mealValue(entry) {
  if (!entry) return 0;
  return (
    Number(entry.breakfast || 0) * state.settings.breakfastWeight +
    Number(entry.lunch || 0) * state.settings.lunchWeight +
    Number(entry.dinner || 0) * state.settings.dinnerWeight
  );
}

function getMonthDates() {
  return Object.keys(state.meals).filter((date) => date.startsWith(state.month));
}

function calculate() {
  const activeMembers = state.members.filter((member) => member.active);
  const foodCost = state.expenses
    .filter((expense) => ["food", "rice"].includes(expense.category))
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const sharedCost = state.expenses
    .filter((expense) => !["food", "rice"].includes(expense.category))
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  const memberRows = activeMembers.map((member) => {
    let actualMeal = 0;
    let guestMeal = 0;
    getMonthDates().forEach((date) => {
      const entry = state.meals[date]?.[member.id];
      actualMeal += mealValue(entry);
      guestMeal += Number(entry?.guest || 0);
    });
    return { member, actualMeal, guestMeal };
  });

  const totalActualMeal = memberRows.reduce((sum, row) => sum + row.actualMeal, 0);
  const mealRate = totalActualMeal > 0 ? foodCost / totalActualMeal : 0;
  const otherPerMember = activeMembers.length > 0 ? sharedCost / activeMembers.length : 0;

  const settlements = memberRows.map((row) => {
    const baseMinimum = row.actualMeal === 0 ? state.settings.zeroMealMinimum : state.settings.fixedMeal;
    const billableMeal = Math.max(row.actualMeal, baseMinimum) + row.guestMeal;
    const totalBill = billableMeal * mealRate + otherPerMember;
    const paid = state.payments
      .filter((payment) => payment.memberId === row.member.id)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return { ...row, billableMeal, totalBill, paid, balance: totalBill - paid };
  });

  return { activeMembers, foodCost, sharedCost, totalActualMeal, mealRate, otherPerMember, settlements };
}

function renderStats() {
  const data = calculate();
  const totalJoma = state.payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalExpense = state.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const stats = [
    ["Active member", data.activeMembers.length],
    ["Total actual meal", data.totalActualMeal.toFixed(1)],
    ["Meal rate", money(data.mealRate)],
    ["Total joma", money(totalJoma)],
    ["Food khoros", money(data.foodCost)],
    ["Other/member", money(data.otherPerMember)],
    ["Total khoros", money(totalExpense)],
    ["Cash balance", money(totalJoma - totalExpense)],
  ];
  document.getElementById("statsGrid").innerHTML = stats
    .map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderDashboard() {
  const rows = calculate().settlements;
  document.getElementById("dashboardRows").innerHTML =
    rows
      .map((row) => {
        const status =
          row.balance > 0
            ? `<span class="status-due">Dibe ${money(row.balance)}</span>`
            : `<span class="status-return">Pabe ${money(Math.abs(row.balance))}</span>`;
        return `<tr>
          <td>${row.member.name}</td>
          <td class="number">${row.actualMeal.toFixed(1)}</td>
          <td class="number">${row.guestMeal.toFixed(1)}</td>
          <td class="number">${row.billableMeal.toFixed(1)}</td>
          <td class="number">${money(row.totalBill)}</td>
          <td class="number">${money(row.paid)}</td>
          <td>${status}</td>
        </tr>`;
      })
      .join("") || `<tr><td colspan="7">No member data yet. Owner/manager can add members.</td></tr>`;
}

function renderMembers() {
  document.getElementById("memberCards").innerHTML =
    state.members
      .map(
        (member, index) => `<div class="member-card clickable" data-type="member" data-id="${member.id}">
          <strong>${Number(member.serial || 0) || index + 1}. ${member.name}</strong>
          <span>${member.email || "No Gmail"} | ${member.phone || "No phone added"}</span>
          ${rowActions("member", member.id)}
        </div>`,
      )
      .join("") || `<p>No members yet. Signed-up users will appear in Roles; owner/manager can add mess members here.</p>`;

  const options = state.members.map((member) => `<option value="${member.id}">${member.name}</option>`).join("");
  ["paymentMember", "bazarMemberA", "bazarMemberB"].forEach((id) => {
    document.getElementById(id).innerHTML = options;
  });
}

function renderRoles() {
  document.getElementById("roleRows").innerHTML =
    state.users
      .map((user) => {
        const isUserOwner = user.email === OWNER_EMAIL || user.role === "owner";
        return `<tr class="clickable" data-type="role" data-id="${user.email}">
          <td><input class="role-name" data-email="${user.email}" value="${user.name || ""}" ${canEditRoles() ? "" : "disabled"}></td>
          <td>${user.email}</td>
          <td>
            <select class="role-select" data-email="${user.email}" ${canEditRoles() && !isUserOwner ? "" : "disabled"}>
              <option value="member" ${user.role === "member" ? "selected" : ""}>member</option>
              <option value="manager" ${user.role === "manager" ? "selected" : ""}>manager</option>
              <option value="owner" ${isUserOwner ? "selected" : ""}>owner</option>
            </select>
          </td>
          <td>${user.blocked ? "Blocked" : isUserOwner || user.role === "manager" ? "Yes" : "No"}</td>
          <td>
            ${canEditRoles() && !isUserOwner ? `<button type="button" class="block-btn ${user.blocked ? "" : "danger"}" data-email="${user.email}">${user.blocked ? "Unblock" : "Block"}</button>` : ""}
            ${rowActions("role", user.email)}
          </td>
        </tr>`;
      })
      .join("") || `<tr><td colspan="5">No signed-up users yet.</td></tr>`;

  document.getElementById("roleUserSelect").innerHTML = state.users
    .filter((user) => user.email !== OWNER_EMAIL && !user.blocked)
    .map((user) => `<option value="${user.email}">${user.name || user.email} - ${user.role}</option>`)
    .join("");
}

function renderMealRows() {
  const date = document.getElementById("mealDate").value;
  if (!state.meals[date]) state.meals[date] = {};
  document.getElementById("mealRows").innerHTML =
    state.members
      .filter((member) => member.active)
      .map((member) => {
        const entry = state.meals[date][member.id] || {
          staying: true,
          breakfast: "",
          lunch: "",
          dinner: "",
          guest: 0,
        };
        const warning = entry.staying && Number(entry.breakfast || 0) === 0 ? "Breakfast missing" : "";
        return `<tr data-member="${member.id}">
          <td>${member.name}</td>
          <td><input type="checkbox" class="staying" ${entry.staying ? "checked" : ""}></td>
          <td><input class="meal-input breakfast" type="number" min="0" step="1" value="${entry.breakfast}"></td>
          <td><input class="meal-input lunch" type="number" min="0" step="1" value="${entry.lunch}"></td>
          <td><input class="meal-input dinner" type="number" min="0" step="1" value="${entry.dinner}"></td>
          <td><input class="meal-input guest" type="number" min="0" step="0.5" value="${entry.guest || 0}"></td>
          <td class="number">${mealValue(entry).toFixed(1)}</td>
          <td class="status-due">${warning}</td>
        </tr>`;
      })
      .join("") || `<tr><td colspan="8">No members yet.</td></tr>`;
}

function renderPayments() {
  const byMember = new Map(state.members.map((member) => [member.id, member.name]));
  document.getElementById("paymentRows").innerHTML =
    state.payments
      .map(
        (payment) => `<tr class="clickable" data-type="payment" data-id="${payment.id}">
          <td>${payment.date}</td>
          <td>${byMember.get(payment.memberId) || "Unknown"}</td>
          <td class="number">${money(payment.amount)}</td>
          <td>${payment.note || ""}</td>
          <td>${rowActions("payment", payment.id)}</td>
        </tr>`,
      )
      .join("") || `<tr><td colspan="5">No joma entries yet.</td></tr>`;
}

function renderExpenses() {
  document.getElementById("expenseRows").innerHTML =
    state.expenses
      .map(
        (expense) => `<tr class="clickable" data-type="expense" data-id="${expense.id}">
          <td>${expense.date}</td>
          <td>${expense.category}</td>
          <td>${expense.item || ""}</td>
          <td class="number">${money(expense.amount)}</td>
          <td>${rowActions("expense", expense.id)}</td>
        </tr>`,
      )
      .join("") || `<tr><td colspan="5">No khoros entries yet.</td></tr>`;
}

function renderBazar() {
  const byMember = new Map(state.members.map((member) => [member.id, member.name]));
  document.getElementById("bazarRows").innerHTML =
    state.bazar
      .map((duty) => {
        const spent = Number(duty.spent || 0);
        const returned = Number(duty.advance || 0) - spent;
        return `<tr class="clickable" data-type="bazar" data-id="${duty.id}">
          <td>${duty.date}</td>
          <td>${byMember.get(duty.memberA) || "Unknown"} + ${byMember.get(duty.memberB) || "Unknown"}</td>
          <td class="number">${money(duty.advance || 0)}</td>
          <td class="number">${money(spent)}</td>
          <td class="number">${money(returned)}</td>
          <td>${duty.list || ""}</td>
          <td>${rowActions("bazar", duty.id)}</td>
        </tr>`;
      })
      .join("") || `<tr><td colspan="7">No bazar duty yet.</td></tr>`;
}

function renderReport() {
  const data = calculate();
  const lines = [
    `Mess report: ${state.month}`,
    `Database: ${firebaseEnabled ? "Firebase Firestore live" : "Local fallback only - Firebase config missing"}`,
    `Owner: ${OWNER_EMAIL}`,
    `Active member: ${data.activeMembers.length}`,
    `Total actual meal: ${data.totalActualMeal.toFixed(1)}`,
    `Food khoros: ${money(data.foodCost)}`,
    `Meal rate: ${money(data.mealRate)}`,
    `Other khoros/member: ${money(data.otherPerMember)}`,
    "",
    "Member settlement:",
  ];
  data.settlements.forEach((row) => {
    const status = row.balance > 0 ? `dibe ${money(row.balance)}` : `pabe ${money(Math.abs(row.balance))}`;
    lines.push(
      `${row.member.name}: meal ${row.actualMeal.toFixed(1)}, billable ${row.billableMeal.toFixed(1)}, bill ${money(row.totalBill)}, joma ${money(row.paid)}, ${status}`,
    );
  });
  document.getElementById("reportText").value = lines.join("\n");

  document.getElementById("whatsappRows").innerHTML =
    data.settlements
      .map((row) => {
        const status = row.balance > 0 ? `apnar baki ${money(row.balance)}` : `apni paben ${money(Math.abs(row.balance))}`;
        const text = `Mess report ${state.month}: meal ${row.actualMeal.toFixed(1)}, bill ${money(row.totalBill)}, joma ${money(row.paid)}, ${status}.`;
        const phone = String(row.member.phone || "").replace(/\D/g, "");
        const href = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
        return `<tr>
          <td>${row.member.name}</td>
          <td>${row.member.phone || "Add phone first"}</td>
          <td><a href="${href}" target="_blank" rel="noreferrer">Send WhatsApp</a></td>
        </tr>`;
      })
      .join("") || `<tr><td colspan="3">No report rows yet.</td></tr>`;
}

function renderAll() {
  renderStats();
  renderDashboard();
  renderMembers();
  renderRoles();
  renderMealRows();
  renderPayments();
  renderExpenses();
  renderBazar();
  renderReport();
  renderAccess();
}

function renderAuth() {
  const user = currentUser();
  const signed = Boolean(currentAuthUser && user && !user.blocked);
  document.body.classList.toggle("locked", !signed);
  document.getElementById("accountEmail").textContent = currentAuthUser?.email || "Not logged in";
  document.getElementById("accountRole").textContent = currentRole();
  if (signed) renderAll();
}

function renderAccess() {
  const canEdit = canEditData();
  document.querySelectorAll("form").forEach((form) => {
    if (form.id === "authForm") return;
    if (form.id === "roleForm") return;
    form.querySelectorAll("input, select, button").forEach((control) => {
      control.disabled = !canEdit;
    });
  });
  document.querySelectorAll("#saveMealsBtn, #seedBtn").forEach((button) => {
    button.disabled = !canEdit;
  });
  document.querySelectorAll(".manager-only input, .manager-only select, .manager-only button").forEach((control) => {
    control.disabled = !canEditRoles();
  });

  const existing = document.querySelector(".readonly-banner");
  const needsBanner = !firebaseEnabled || !canEdit;
  if (needsBanner && !existing) {
    const banner = document.createElement("div");
    banner.className = "readonly-banner";
    banner.textContent = firebaseEnabled
      ? "You are logged in as member. Only owner/manager can add or edit entries."
      : "Firebase config missing: this is local fallback only, not shared database yet.";
    document.querySelector("main").prepend(banner);
  }
  if (!needsBanner && existing) existing.remove();
}

async function addOrUpdateMember(event) {
  event.preventDefault();
  if (!requireDataPower()) return;
  const id = editing.memberId || localId();
  const payload = {
    name: document.getElementById("memberName").value.trim(),
    phone: document.getElementById("memberPhone").value.trim(),
    email: "",
    active: true,
    serial: editing.memberId ? state.members.find((item) => item.id === editing.memberId)?.serial || state.members.length : state.members.length + 1,
  };
  await saveDoc("members", id, payload);
  event.target.reset();
  setEditing("member");
}

async function addOrUpdatePayment(event) {
  event.preventDefault();
  if (!requireDataPower()) return;
  const id = editing.paymentId || localId();
  await saveDoc("payments", id, {
    memberId: document.getElementById("paymentMember").value,
    date: document.getElementById("paymentDate").value,
    amount: Number(document.getElementById("paymentAmount").value || 0),
    note: "Manual entry",
  });
  event.target.reset();
  setEditing("payment");
  document.getElementById("paymentDate").value = isoDate;
}

async function addOrUpdateExpense(event) {
  event.preventDefault();
  if (!requireDataPower()) return;
  const id = editing.expenseId || localId();
  await saveDoc("expenses", id, {
    date: document.getElementById("expenseDate").value,
    category: document.getElementById("expenseCategory").value,
    item: document.getElementById("expenseItem").value.trim(),
    amount: Number(document.getElementById("expenseAmount").value || 0),
  });
  event.target.reset();
  setEditing("expense");
  document.getElementById("expenseDate").value = isoDate;
}

async function addOrUpdateBazar(event) {
  event.preventDefault();
  if (!requireDataPower()) return;
  const id = editing.bazarId || localId();
  await saveDoc("bazar", id, {
    date: document.getElementById("bazarDate").value,
    memberA: document.getElementById("bazarMemberA").value,
    memberB: document.getElementById("bazarMemberB").value,
    advance: Number(document.getElementById("bazarAdvance").value || 0),
    spent: Number(document.getElementById("bazarSpent").value || 0),
    list: document.getElementById("bazarList").value.trim(),
  });
  event.target.reset();
  setEditing("bazar");
  document.getElementById("bazarDate").value = isoDate;
}

async function saveMeals() {
  if (!requireDataPower()) return;
  const date = document.getElementById("mealDate").value;
  const entries = {};
  document.querySelectorAll("#mealRows tr[data-member]").forEach((row) => {
    const memberId = row.dataset.member;
    entries[memberId] = {
      staying: row.querySelector(".staying").checked,
      breakfast: Number(row.querySelector(".breakfast").value || 0),
      lunch: Number(row.querySelector(".lunch").value || 0),
      dinner: Number(row.querySelector(".dinner").value || 0),
      guest: Number(row.querySelector(".guest").value || 0),
    };
  });
  await saveMealDate(date, entries);
}

function editItem(type, id) {
  if (type === "role") {
    if (!requireOwner()) return;
    document.querySelector(`.role-name[data-email="${CSS.escape(id)}"]`)?.focus();
    return;
  }
  if (!requireDataPower()) return;
  if (type === "member") {
    const member = state.members.find((item) => item.id === id);
    if (!member) return;
    document.getElementById("memberName").value = member.name || "";
    document.getElementById("memberPhone").value = member.phone || "";
    setEditing("member", id);
  }
  if (type === "payment") {
    const payment = state.payments.find((item) => item.id === id);
    if (!payment) return;
    document.getElementById("paymentMember").value = payment.memberId || "";
    document.getElementById("paymentDate").value = payment.date || isoDate;
    document.getElementById("paymentAmount").value = payment.amount || "";
    setEditing("payment", id);
  }
  if (type === "expense") {
    const expense = state.expenses.find((item) => item.id === id);
    if (!expense) return;
    document.getElementById("expenseDate").value = expense.date || isoDate;
    document.getElementById("expenseCategory").value = expense.category || "food";
    document.getElementById("expenseItem").value = expense.item || "";
    document.getElementById("expenseAmount").value = expense.amount || "";
    setEditing("expense", id);
  }
  if (type === "bazar") {
    const duty = state.bazar.find((item) => item.id === id);
    if (!duty) return;
    document.getElementById("bazarDate").value = duty.date || isoDate;
    document.getElementById("bazarMemberA").value = duty.memberA || "";
    document.getElementById("bazarMemberB").value = duty.memberB || "";
    document.getElementById("bazarAdvance").value = duty.advance || "";
    document.getElementById("bazarSpent").value = duty.spent || "";
    document.getElementById("bazarList").value = duty.list || "";
    setEditing("bazar", id);
  }
}

async function deleteItem(type, id) {
  if (type === "role") {
    if (!requireOwner()) return;
    if (id === OWNER_EMAIL) {
      alert("Owner cannot be deleted.");
      return;
    }
    if (!confirm(`Delete user ${id}?`)) return;
    const user = state.users.find((item) => item.email === id);
    if (!user) return;
    await deleteDoc("users", user.id);
    return;
  }
  if (!requireDataPower()) return;
  if (!confirm(`Delete this ${type}?`)) return;
  await deleteDoc(type === "payment" ? "payments" : type === "expense" ? "expenses" : type, id);
}

async function updateRole(email, patch) {
  if (!requireOwner()) return;
  if (email === OWNER_EMAIL && patch.role && patch.role !== "owner") {
    alert("Owner role cannot be changed.");
    return;
  }
  if (!firebaseEnabled) {
    const localAuth = loadLocalAuth();
    const user = localAuth.users.find((item) => item.email === email);
    if (user) Object.assign(user, patch);
    saveLocalAuth(localAuth);
    state.users = localAuth.users;
    renderAll();
    return;
  }
  const user = state.users.find((item) => item.email === email);
  if (!user) return;
  await db.collection(collectionName("users")).doc(user.id).set(patch, { merge: true });
}

async function blockUser(email, blocked) {
  await updateRole(email, { blocked });
}

async function signIn(event) {
  event.preventDefault();
  if (firebaseEnabled) {
    await firebase.auth().signInWithPopup(authProvider);
    return;
  }
  const email = normalizeEmail(document.getElementById("authEmail").value);
  const name = document.getElementById("authName").value.trim() || email.split("@")[0];
  const message = document.getElementById("authMessage");
  if (!isGmail(email)) {
    message.textContent = "Firebase config missing. For temporary local test, enter a valid @gmail.com.";
    return;
  }
  await ensureUser({ email, name });
  message.textContent = "";
  renderAuth();
}

async function logout() {
  if (firebaseEnabled) await firebase.auth().signOut();
  currentAuthUser = null;
  renderAuth();
}

function setupEvents() {
  document.getElementById("monthInput").value = state.month;
  document.getElementById("mealDate").value = isoDate;
  document.getElementById("paymentDate").value = isoDate;
  document.getElementById("expenseDate").value = isoDate;
  document.getElementById("bazarDate").value = isoDate;

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab, .panel").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(button.dataset.tab).classList.add("active");
    });
  });

  document.getElementById("monthInput").addEventListener("change", (event) => {
    state.month = event.target.value;
    saveLocalState();
    renderAll();
  });
  document.getElementById("mealDate").addEventListener("change", renderMealRows);
  document.getElementById("saveMealsBtn").addEventListener("click", saveMeals);
  document.getElementById("memberForm").addEventListener("submit", addOrUpdateMember);
  document.getElementById("paymentForm").addEventListener("submit", addOrUpdatePayment);
  document.getElementById("expenseForm").addEventListener("submit", addOrUpdateExpense);
  document.getElementById("bazarForm").addEventListener("submit", addOrUpdateBazar);
  document.getElementById("authForm").addEventListener("submit", signIn);
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("copyReportBtn").addEventListener("click", async () => {
    await navigator.clipboard.writeText(document.getElementById("reportText").value);
  });
  document.getElementById("seedBtn").addEventListener("click", () => {
    if (!requireDataPower()) return;
    localStorage.removeItem(LOCAL_STATE_KEY);
    localStorage.removeItem(LOCAL_AUTH_KEY);
    location.reload();
  });

  document.addEventListener("click", async (event) => {
    const editButton = event.target.closest(".edit-btn");
    const deleteButton = event.target.closest(".delete-btn");
    const blockButton = event.target.closest(".block-btn");
    const clickable = event.target.closest(".clickable");

    if (editButton) {
      event.stopPropagation();
      editItem(editButton.dataset.type, editButton.dataset.id);
      return;
    }
    if (deleteButton) {
      event.stopPropagation();
      await deleteItem(deleteButton.dataset.type, deleteButton.dataset.id);
      return;
    }
    if (blockButton) {
      event.stopPropagation();
      const user = state.users.find((item) => item.email === blockButton.dataset.email);
      await blockUser(blockButton.dataset.email, !user?.blocked);
      return;
    }
    if (clickable && !event.target.matches("input, select, button, a")) {
      editItem(clickable.dataset.type, clickable.dataset.id);
    }
  });

  ["member", "payment", "expense", "bazar"].forEach((type) => {
    document.getElementById(`${type}CancelBtn`)?.addEventListener("click", () => {
      document.getElementById(`${type}Form`).reset();
      setEditing(type);
      if (type !== "member") document.getElementById(`${type}Date`).value = isoDate;
    });
  });

  document.getElementById("roleRows").addEventListener("change", async (event) => {
    if (!requireOwner()) return;
    const email = event.target.dataset.email;
    if (!email) return;
    if (event.target.classList.contains("role-name")) {
      await updateRole(email, { name: event.target.value.trim() });
    }
    if (event.target.classList.contains("role-select")) {
      await updateRole(email, { role: event.target.value });
    }
  });

  document.getElementById("roleForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireOwner()) return;
    const email = document.getElementById("roleUserSelect").value;
    if (email) await updateRole(email, { role: "manager", blocked: false });
  });
}

(async function boot() {
  setupEvents();
  const firebaseReady = await initFirebase();
  if (!firebaseReady) {
    loadLocalState();
    const localAuth = loadLocalAuth();
    state.users = localAuth.users;
    renderAuth();
  }
})();
