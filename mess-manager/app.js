const STORAGE_KEY = "mess-manager-v1";
const AUTH_KEY = "mess-manager-auth-v1";

const defaultMembers = [
  "Hamidur Vai",
  "Boro Vai",
  "Rifat",
  "Niloy",
  "Arif",
  "Golam",
  "Habibul",
  "Imdad",
  "Naim",
  "Sakib",
  "Dihan",
  "Sohan",
  "Munir",
  "Asif",
  "Sabbir",
  "Akash",
  "Siam",
  "Ruhan",
  "Kamal",
  "Rabiul",
  "Nahid",
  "Rakib",
  "Tanvir",
  "Shazid",
  "Hamidul 2",
  "Noman",
];

const today = new Date();
const isoDate = today.toISOString().slice(0, 10);
const isoMonth = isoDate.slice(0, 7);

const state = loadState();
const auth = loadAuth();

function loadAuth() {
  const saved = localStorage.getItem(AUTH_KEY);
  if (saved) return JSON.parse(saved);
  return { currentEmail: "", users: [] };
}

function saveAuth() {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);

  const members = defaultMembers.map((name, index) => ({
    id: crypto.randomUUID(),
    name,
    phone: "",
    active: true,
    serial: index + 1,
  }));

  const payments = members.slice(0, 8).map((member, index) => ({
    id: crypto.randomUUID(),
    memberId: member.id,
    date: `${isoMonth}-${String(Math.min(10 + index, 28)).padStart(2, "0")}`,
    amount: index % 3 === 0 ? 2500 : 2000,
    note: "Monthly collection",
  }));

  const expenses = [
    { category: "food", item: "Bazar", amount: 12840 },
    { category: "rice", item: "Chaul", amount: 8050 },
    { category: "gas", item: "Gas", amount: 3000 },
    { category: "wifi", item: "Wifi", amount: 1200 },
    { category: "current", item: "Current", amount: 2600 },
    { category: "khala", item: "Khala", amount: 8050 },
    { category: "extra", item: "Tuki taki", amount: 1450 },
  ].map((expense, index) => ({
    id: crypto.randomUUID(),
    date: `${isoMonth}-${String(index + 1).padStart(2, "0")}`,
    ...expense,
  }));

  const meals = {};
  for (let day = 1; day <= 12; day += 1) {
    const date = `${isoMonth}-${String(day).padStart(2, "0")}`;
    meals[date] = {};
    members.forEach((member, index) => {
      const full = (index + day) % 5 !== 0;
      meals[date][member.id] = {
        staying: full,
        breakfast: full ? 1 : 0,
        lunch: full ? 1 : 0,
        dinner: full ? 1 : 0,
        guest: index === 3 && day === 4 ? 1 : 0,
      };
    });
  }

  return {
    month: isoMonth,
    settings: {
      breakfastWeight: 0.5,
      lunchWeight: 1,
      dinnerWeight: 1,
      fixedMeal: 50,
      zeroMealMinimum: 25,
      contributionTargets: [1000, 1000, 500],
    },
    members,
    meals,
    payments,
    expenses,
    bazar: [],
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function money(value) {
  return `৳${Math.round(value).toLocaleString("en-BD")}`;
}

function currentUser() {
  return auth.users.find((user) => user.email === auth.currentEmail) || null;
}

function isManager() {
  return currentUser()?.role === "manager";
}

function requireManager() {
  if (isManager()) return true;
  alert("Only manager can entry/edit data.");
  return false;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function isGmail(email) {
  return /^[^\s@]+@gmail\.com$/i.test(email);
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
    const baseMinimum =
      row.actualMeal === 0 ? state.settings.zeroMealMinimum : state.settings.fixedMeal;
    const billableMeal = Math.max(row.actualMeal, baseMinimum) + row.guestMeal;
    const mealBill = billableMeal * mealRate;
    const totalBill = mealBill + otherPerMember;
    const paid = state.payments
      .filter((payment) => payment.memberId === row.member.id)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return { ...row, billableMeal, mealBill, totalBill, paid, balance: totalBill - paid };
  });

  return {
    activeMembers,
    foodCost,
    sharedCost,
    totalActualMeal,
    mealRate,
    otherPerMember,
    settlements,
  };
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
  document.getElementById("dashboardRows").innerHTML = rows
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
    .join("");
}

function renderMembers() {
  document.getElementById("memberCards").innerHTML = state.members
    .map(
      (member) => `<div class="member-card">
        <strong>${member.serial}. ${member.name}</strong>
        <span>${member.phone || "No phone added"}</span>
      </div>`,
    )
    .join("");

  const options = state.members
    .map((member) => `<option value="${member.id}">${member.name}</option>`)
    .join("");
  ["paymentMember", "bazarMemberA", "bazarMemberB"].forEach((id) => {
    document.getElementById(id).innerHTML = options;
  });
}

function renderRoles() {
  const rows = auth.users
    .map(
      (user) => `<tr>
        <td>${user.name || "No name"}</td>
        <td>${user.email}</td>
        <td>${user.role}</td>
        <td>${user.role === "manager" ? "Yes" : "No"}</td>
      </tr>`,
    )
    .join("");
  document.getElementById("roleRows").innerHTML =
    rows || `<tr><td colspan="4">No signed-up users yet.</td></tr>`;

  document.getElementById("roleUserSelect").innerHTML = auth.users
    .map((user) => `<option value="${user.email}">${user.name || user.email} - ${user.role}</option>`)
    .join("");
}

function renderMealRows() {
  const date = document.getElementById("mealDate").value;
  if (!state.meals[date]) state.meals[date] = {};
  document.getElementById("mealRows").innerHTML = state.members
    .filter((member) => member.active)
    .map((member) => {
      const entry = state.meals[date][member.id] || {
        staying: true,
        breakfast: "",
        lunch: "",
        dinner: "",
        guest: 0,
      };
      const warning =
        entry.staying && Number(entry.breakfast || 0) === 0 ? "Breakfast missing" : "";
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
    .join("");
}

function renderPayments() {
  const byMember = new Map(state.members.map((member) => [member.id, member.name]));
  document.getElementById("paymentRows").innerHTML = state.payments
    .map(
      (payment) => `<tr>
        <td>${payment.date}</td>
        <td>${byMember.get(payment.memberId) || "Unknown"}</td>
        <td class="number">${money(payment.amount)}</td>
        <td>${payment.note || ""}</td>
      </tr>`,
    )
    .join("");
}

function renderExpenses() {
  document.getElementById("expenseRows").innerHTML = state.expenses
    .map(
      (expense) => `<tr>
        <td>${expense.date}</td>
        <td>${expense.category}</td>
        <td>${expense.item || ""}</td>
        <td class="number">${money(expense.amount)}</td>
      </tr>`,
    )
    .join("");
}

function renderBazar() {
  const byMember = new Map(state.members.map((member) => [member.id, member.name]));
  document.getElementById("bazarRows").innerHTML = state.bazar
    .map((duty) => {
      const spent = state.expenses
        .filter((expense) => expense.date === duty.date && ["food", "rice"].includes(expense.category))
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      const returned = Number(duty.advance || 0) - spent;
      return `<tr>
        <td>${duty.date}</td>
        <td>${byMember.get(duty.memberA)} + ${byMember.get(duty.memberB)}</td>
        <td class="number">${money(duty.advance || 0)}</td>
        <td class="number">${money(spent)}</td>
        <td class="number">${money(returned)}</td>
        <td>${duty.list || "Rice, fish, vegetable, oil, spice"}</td>
      </tr>`;
    })
    .join("");
}

function renderReport() {
  const data = calculate();
  const lines = [
    `Mess report: ${state.month}`,
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

  document.getElementById("whatsappRows").innerHTML = data.settlements
    .map((row) => {
      const status = row.balance > 0 ? `apnar baki ${money(row.balance)}` : `apni paben ${money(Math.abs(row.balance))}`;
      const text = `Mess report ${state.month}: meal ${row.actualMeal.toFixed(1)}, bill ${money(row.totalBill)}, joma ${money(row.paid)}, ${status}.`;
      const phone = row.member.phone.replace(/\D/g, "");
      const href = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
      return `<tr>
        <td>${row.member.name}</td>
        <td>${row.member.phone || "Add phone first"}</td>
        <td><a href="${href}" target="_blank" rel="noreferrer">Send WhatsApp</a></td>
      </tr>`;
    })
    .join("");
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
  document.body.classList.toggle("locked", !user);
  document.getElementById("accountEmail").textContent = user?.email || "Not logged in";
  document.getElementById("accountRole").textContent = user?.role || "member";
  if (user) renderAll();
}

function renderAccess() {
  const canEdit = isManager();

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
    control.disabled = !canEdit;
  });

  const existing = document.querySelector(".readonly-banner");
  if (!canEdit && !existing) {
    const banner = document.createElement("div");
    banner.className = "readonly-banner";
    banner.textContent = "You are logged in as member. You can monitor reports, but only manager can add or edit entries.";
    document.querySelector("main").prepend(banner);
  }
  if (canEdit && existing) existing.remove();
}

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
  saveState();
  renderAll();
});

document.getElementById("mealDate").addEventListener("change", renderMealRows);

document.getElementById("saveMealsBtn").addEventListener("click", () => {
  if (!requireManager()) return;
  const date = document.getElementById("mealDate").value;
  state.meals[date] = {};
  document.querySelectorAll("#mealRows tr").forEach((row) => {
    const memberId = row.dataset.member;
    state.meals[date][memberId] = {
      staying: row.querySelector(".staying").checked,
      breakfast: Number(row.querySelector(".breakfast").value || 0),
      lunch: Number(row.querySelector(".lunch").value || 0),
      dinner: Number(row.querySelector(".dinner").value || 0),
      guest: Number(row.querySelector(".guest").value || 0),
    };
  });
  saveState();
  renderAll();
});

document.getElementById("memberForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!requireManager()) return;
  state.members.push({
    id: crypto.randomUUID(),
    name: document.getElementById("memberName").value.trim(),
    phone: document.getElementById("memberPhone").value.trim(),
    active: true,
    serial: state.members.length + 1,
  });
  event.target.reset();
  saveState();
  renderAll();
});

document.getElementById("paymentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!requireManager()) return;
  state.payments.push({
    id: crypto.randomUUID(),
    memberId: document.getElementById("paymentMember").value,
    date: document.getElementById("paymentDate").value,
    amount: Number(document.getElementById("paymentAmount").value || 0),
    note: "Manual entry",
  });
  event.target.reset();
  document.getElementById("paymentDate").value = isoDate;
  saveState();
  renderAll();
});

document.getElementById("expenseForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!requireManager()) return;
  state.expenses.push({
    id: crypto.randomUUID(),
    date: document.getElementById("expenseDate").value,
    category: document.getElementById("expenseCategory").value,
    item: document.getElementById("expenseItem").value.trim(),
    amount: Number(document.getElementById("expenseAmount").value || 0),
  });
  event.target.reset();
  document.getElementById("expenseDate").value = isoDate;
  saveState();
  renderAll();
});

document.getElementById("bazarForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!requireManager()) return;
  state.bazar.push({
    id: crypto.randomUUID(),
    date: document.getElementById("bazarDate").value,
    memberA: document.getElementById("bazarMemberA").value,
    memberB: document.getElementById("bazarMemberB").value,
    advance: Number(document.getElementById("bazarAdvance").value || 0),
    list: "Rice, dal, fish/meat, vegetable, oil, spice",
  });
  event.target.reset();
  document.getElementById("bazarDate").value = isoDate;
  saveState();
  renderAll();
});

document.getElementById("copyReportBtn").addEventListener("click", async () => {
  await navigator.clipboard.writeText(document.getElementById("reportText").value);
});

document.getElementById("seedBtn").addEventListener("click", () => {
  if (!requireManager()) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

document.getElementById("authForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const email = normalizeEmail(document.getElementById("authEmail").value);
  const name = document.getElementById("authName").value.trim();
  const message = document.getElementById("authMessage");

  if (!isGmail(email)) {
    message.textContent = "Please use a valid @gmail.com address.";
    return;
  }

  let user = auth.users.find((item) => item.email === email);
  if (!user) {
    const role = auth.users.some((item) => item.role === "manager") ? "member" : "manager";
    user = { email, name: name || email.split("@")[0], role };
    auth.users.push(user);
  } else if (name && !user.name) {
    user.name = name;
  }

  auth.currentEmail = email;
  saveAuth();
  message.textContent = "";
  renderAuth();
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  auth.currentEmail = "";
  saveAuth();
  renderAuth();
});

document.getElementById("roleForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!requireManager()) return;
  const nextManagerEmail = document.getElementById("roleUserSelect").value;
  auth.users = auth.users.map((user) => ({
    ...user,
    role: user.email === nextManagerEmail ? "manager" : "member",
  }));
  saveAuth();
  renderAuth();
});

renderAuth();
