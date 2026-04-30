const adminUsername = "admin";
const adminPassword = "admin123";
const authKey = "shumoosAdminAuthenticated";
const loginScreen = document.getElementById("loginScreen");
const adminShell = document.getElementById("adminShell");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const logoutButton = document.getElementById("logoutButton");
const adminForm = document.getElementById("adminForm");
const adminMessage = document.getElementById("adminMessage");
const resetContent = document.getElementById("resetContent");

let draftContent = getSiteContent();

const readImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.addEventListener("load", () => resolve(reader.result));
  reader.addEventListener("error", reject);
  reader.readAsDataURL(file);
});

const simpleFields = [
  "brand",
  "whatsappNumber",
  "navCta",
  "heroBadge",
  "heroTitle",
  "heroText",
  "whyTitle",
  "servicesTitle",
  "coverageTitle",
  "coverageText",
  "panelTitle",
  "panelText",
  "plansTitle",
  "contractTitle",
  "contractText",
];

const imageFields = [
  "heroImage",
  "coverageImage",
  "heroBg",
  "servicesBg",
  "coverageBg",
  "plansBg",
  "contractBg",
];

const itemFactory = {
  whyItems: () => "نقطة تميز جديدة",
  services: () => ({ title: "خدمة جديدة", text: "وصف الخدمة", image: "" }),
  coverageItems: () => ({ title: "مدينة جديدة", text: "وصف نطاق الخدمة" }),
  plans: () => ({ title: "خطة جديدة", text: "وصف الخطة", tag: "", featured: false }),
};

const showAdmin = () => {
  loginScreen.hidden = true;
  adminShell.hidden = false;
};

const showLogin = () => {
  loginScreen.hidden = false;
  adminShell.hidden = true;
};

const setFieldValues = () => {
  simpleFields.forEach((key) => {
    const field = adminForm.elements[key];
    if (field) field.value = draftContent[key] || "";
  });

  imageFields.forEach((key) => {
    const field = adminForm.elements[key];
    if (!field || field.closest("label")?.querySelector(".admin-preview")) return;
    if (!draftContent[key]) return;

    const preview = createElement("img", "admin-preview");
    preview.src = draftContent[key];
    preview.alt = "معاينة الصورة";
    field.closest("label").append(preview);
  });
};

const editorShell = (title, listKey, index) => {
  const item = createElement("div", "repeat-item");
  const header = createElement("div", "repeat-header");
  header.append(createElement("h3", "", title));

  const removeButton = createElement("button", "btn btn-danger", "حذف");
  removeButton.type = "button";
  removeButton.addEventListener("click", () => {
    draftContent[listKey].splice(index, 1);
    renderEditors();
  });

  header.append(removeButton);
  item.append(header);
  return item;
};

const textInput = (labelText, value, onInput) => {
  const label = createElement("label");
  label.textContent = labelText;
  const input = createElement("input");
  input.type = "text";
  input.value = value || "";
  input.addEventListener("input", (event) => onInput(event.target.value));
  label.append(input);
  return label;
};

const textArea = (labelText, value, onInput) => {
  const label = createElement("label", "full");
  label.textContent = labelText;
  const area = createElement("textarea");
  area.rows = 3;
  area.value = value || "";
  area.addEventListener("input", (event) => onInput(event.target.value));
  label.append(area);
  return label;
};

const imageInput = (labelText, currentImage, onImage) => {
  const label = createElement("label", "full");
  label.textContent = labelText;
  const input = createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (file) onImage(await readImage(file));
  });
  label.append(input);

  if (currentImage) {
    const preview = createElement("img", "admin-preview");
    preview.src = currentImage;
    preview.alt = "معاينة الصورة";
    label.append(preview);
  }

  return label;
};

const checkboxInput = (labelText, checked, onChange) => {
  const label = createElement("label", "check-label");
  const input = createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(checked);
  input.addEventListener("change", (event) => onChange(event.target.checked));
  label.append(input, document.createTextNode(labelText));
  return label;
};

const renderWhyEditor = () => {
  const container = document.getElementById("whyItemsEditor");
  const items = draftContent.whyItems || [];
  container.replaceChildren(...items.map((value, index) => {
    const item = editorShell(`نقطة ${index + 1}`, "whyItems", index);
    const grid = createElement("div", "admin-grid");
    grid.append(textArea("النص", value, (next) => { draftContent.whyItems[index] = next; }));
    item.append(grid);
    return item;
  }));
};

const renderServicesEditor = () => {
  const container = document.getElementById("servicesEditor");
  const items = draftContent.services || [];
  container.replaceChildren(...items.map((service, index) => {
    const item = editorShell(service.title || `خدمة ${index + 1}`, "services", index);
    const grid = createElement("div", "admin-grid");
    grid.append(
      textInput("عنوان الخدمة", service.title, (next) => { service.title = next; }),
      imageInput("صورة الخدمة", service.image, (next) => {
        service.image = next;
        renderServicesEditor();
      }),
      textArea("وصف الخدمة", service.text, (next) => { service.text = next; }),
    );
    item.append(grid);
    return item;
  }));
};

const renderCoverageEditor = () => {
  const container = document.getElementById("coverageItemsEditor");
  const items = draftContent.coverageItems || [];
  container.replaceChildren(...items.map((coverage, index) => {
    const item = editorShell(coverage.title || `مدينة ${index + 1}`, "coverageItems", index);
    const grid = createElement("div", "admin-grid");
    grid.append(
      textInput("المدينة / النطاق", coverage.title, (next) => { coverage.title = next; }),
      textArea("الوصف", coverage.text, (next) => { coverage.text = next; }),
    );
    item.append(grid);
    return item;
  }));
};

const renderPlansEditor = () => {
  const container = document.getElementById("plansEditor");
  const items = draftContent.plans || [];
  container.replaceChildren(...items.map((plan, index) => {
    const item = editorShell(plan.title || `خطة ${index + 1}`, "plans", index);
    const grid = createElement("div", "admin-grid");
    grid.append(
      textInput("عنوان الخطة", plan.title, (next) => { plan.title = next; }),
      textInput("وسم اختياري", plan.tag, (next) => { plan.tag = next; }),
      textArea("وصف الخطة", plan.text, (next) => { plan.text = next; }),
      checkboxInput("تمييز الخطة بصريًا", plan.featured, (next) => { plan.featured = next; }),
    );
    item.append(grid);
    return item;
  }));
};

const renderEditors = () => {
  setFieldValues();
  renderWhyEditor();
  renderServicesEditor();
  renderCoverageEditor();
  renderPlansEditor();
};

if (sessionStorage.getItem(authKey) === "true") {
  showAdmin();
} else {
  showLogin();
}

if (loginForm) {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const username = formData.get("username")?.trim();
    const password = formData.get("password")?.trim();

    if (username === adminUsername && password === adminPassword) {
      sessionStorage.setItem(authKey, "true");
      loginMessage.textContent = "";
      loginForm.reset();
      showAdmin();
      return;
    }

    loginMessage.textContent = "اسم المستخدم أو كلمة المرور غير صحيحة.";
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem(authKey);
    showLogin();
  });
}

document.querySelectorAll("[data-add-list]").forEach((button) => {
  button.addEventListener("click", () => {
    const listKey = button.dataset.addList;
    draftContent[listKey] = draftContent[listKey] || [];
    draftContent[listKey].push(itemFactory[listKey]());
    renderEditors();
  });
});

if (adminForm) {
  renderEditors();

  adminForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(adminForm);

    simpleFields.forEach((key) => {
      draftContent[key] = formData.get(key)?.trim() || "";
    });

    for (const field of imageFields) {
      const file = adminForm.elements[field]?.files?.[0];
      if (file) draftContent[field] = await readImage(file);
    }

    saveSiteContent(draftContent);
    applySiteContent();
    adminMessage.textContent = "تم حفظ التغييرات بنجاح.";
  });
}

if (resetContent) {
  resetContent.addEventListener("click", () => {
    localStorage.removeItem(contentKey);
    draftContent = getSiteContent();
    renderEditors();
    applySiteContent();
    adminMessage.textContent = "تمت استعادة المحتوى الافتراضي.";
  });
}
