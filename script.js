const contractForm = document.getElementById("contractForm");
const formMessage = document.getElementById("formMessage");
const contentKey = "shumoosSiteContent";

const defaultContent = {
  brand: "شموس للمصاعد",
  navCta: "طلب خدمة",
  whatsappNumber: "00966551800192",
  heroBadge: "صيانة دورية • طوارئ • معاينة حسب الطلب",
  heroTitle: "تعاقد صيانة مصاعد موثوق في مكة وجدة",
  heroText: "نقدم خطط صيانة سنوية وشهرية للمصاعد السكنية والتجارية مع زيارات دورية، استجابة سريعة للأعطال، وتقارير فنية واضحة تساعدك على رفع مستوى السلامة وتقليل التوقفات.",
  whyTitle: "لماذا شموس للمصاعد؟",
  whyItems: [
    "استقبال طلبات المعاينة والصيانة من خلال نموذج مباشر.",
    "تغطية كاملة داخل مكة وجدة.",
    "عقود مرنة للعمائر، الفنادق، المولات والشركات.",
    "تجهيز بيانات الطلب لإرسالها فورًا عبر واتساب.",
  ],
  servicesTitle: "خدمات الصيانة",
  services: [
    {
      title: "صيانة وقائية",
      text: "فحوصات دورية وتزييت ومعايرة للأجزاء الحساسة قبل حدوث الأعطال.",
      image: "",
    },
    {
      title: "صيانة تصحيحية",
      text: "إصلاح الأعطال الكهربائية والميكانيكية بسرعة عبر فريق ميداني جاهز.",
      image: "",
    },
    {
      title: "تحديثات السلامة",
      text: "تركيب أو تحديث أنظمة الأمان بما يتوافق مع متطلبات المباني الحديثة.",
      image: "",
    },
  ],
  coverageTitle: "نطاق التغطية",
  coverageText: "نوفر خدماتنا الميدانية داخل:",
  coverageItems: [
    {
      title: "مكة المكرمة",
      text: "الأحياء المركزية والضواحي مع فرق استجابة يومية.",
    },
    {
      title: "جدة",
      text: "شمال جدة، وسط جدة، وجنوب جدة بزيارات منتظمة.",
    },
  ],
  panelTitle: "جاهز لاستقبال الطلبات",
  panelText: "يجمع النموذج بيانات الجهة، المدينة، عدد المصاعد، المسؤول، رقم الجوال والملاحظات، ثم يفتح واتساب برسالة مرتبة يمكن إرسالها مباشرة لفريق العمل.",
  plansTitle: "خطط التعاقد",
  plans: [
    {
      title: "الخطة الأساسية",
      text: "زيارتان شهريًا + دعم خلال ساعات العمل الرسمية.",
      tag: "",
      featured: false,
    },
    {
      title: "الخطة المتقدمة",
      text: "4 زيارات شهرية + تقارير شهرية + أولوية للأعطال الطارئة.",
      tag: "الأكثر طلبًا",
      featured: true,
    },
    {
      title: "الخطة الشاملة",
      text: "زيارات أسبوعية + تغطية طوارئ كاملة + مدير حساب للموقع.",
      tag: "",
      featured: false,
    },
  ],
  contractTitle: "طلب تعاقد صيانة",
  contractText: "املأ النموذج التالي وسيتم فتح واتساب برسالة جاهزة تحتوي على تفاصيل الطلب.",
  heroImage: "",
  coverageImage: "",
  heroBg: "",
  servicesBg: "",
  coverageBg: "",
  plansBg: "",
  contractBg: "",
};

const getSiteContent = () => {
  try {
    const savedContent = JSON.parse(localStorage.getItem(contentKey)) || {};
    const content = { ...defaultContent, ...savedContent };
    content.whatsappNumber = savedContent.whatsappNumber || defaultContent.whatsappNumber;
    return content;
  } catch {
    return { ...defaultContent };
  }
};

const saveSiteContent = (content) => {
  localStorage.setItem(contentKey, JSON.stringify({ ...getSiteContent(), ...content }));
};

const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
};

const renderWhyItems = (items) => {
  const list = document.getElementById("whyList");
  if (!list) return;
  list.replaceChildren(...items.filter(Boolean).map((item) => createElement("li", "", item)));
};

const renderServices = (services) => {
  const grid = document.getElementById("servicesGrid");
  if (!grid) return;

  const cards = services.map((service) => {
    const card = createElement("article", "card");
    if (service.image) {
      const image = createElement("img", "card-image");
      image.src = service.image;
      image.alt = service.title || "صورة الخدمة";
      card.append(image);
    }
    card.append(createElement("h3", "", service.title), createElement("p", "", service.text));
    return card;
  });

  grid.replaceChildren(...cards);
};

const renderCoverage = (items) => {
  const list = document.getElementById("coverageList");
  const citySelect = contractForm?.elements.city;
  if (list) {
    const rows = items.map((item) => {
      const row = createElement("li");
      const title = createElement("strong", "", `${item.title}:`);
      row.append(title, document.createTextNode(` ${item.text}`));
      return row;
    });
    list.replaceChildren(...rows);
  }

  if (citySelect) {
    const options = [new Option("اختر المدينة", "")];
    items.forEach((item) => options.push(new Option(item.title, item.title)));
    citySelect.replaceChildren(...options);
  }
};

const renderPlans = (plans) => {
  const grid = document.getElementById("plansGrid");
  if (!grid) return;

  const cards = plans.map((plan) => {
    const card = createElement("article", `card plan${plan.featured ? " featured" : ""}`);
    if (plan.tag) card.append(createElement("p", "tag", plan.tag));
    card.append(createElement("h3", "", plan.title), createElement("p", "", plan.text));
    return card;
  });

  grid.replaceChildren(...cards);
};

const applySiteContent = () => {
  const content = getSiteContent();

  document.querySelectorAll(".brand").forEach((element) => {
    element.textContent = content.brand;
  });

  document.querySelectorAll("[data-content]").forEach((element) => {
    const key = element.dataset.content;
    if (content[key]) element.textContent = content[key];
  });

  document.querySelectorAll("[data-image]").forEach((image) => {
    const source = content[image.dataset.image];
    image.hidden = !source;
    if (source) image.src = source;
  });

  document.querySelectorAll("[data-bg]").forEach((section) => {
    const source = content[section.dataset.bg];
    section.classList.toggle("has-bg-image", Boolean(source));
    section.style.backgroundImage = source ? `url("${source}")` : "";
  });

  renderWhyItems(content.whyItems || []);
  renderServices(content.services || []);
  renderCoverage(content.coverageItems || []);
  renderPlans(content.plans || []);
};

const normalizeWhatsappNumber = (number) => {
  const digits = number.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `966${digits.slice(1)}`;
  return digits;
};

applySiteContent();

const buildRequestMessage = (formData) => {
  const notes = formData.get("notes")?.trim() || "لا توجد";

  return [
    "طلب تعاقد صيانة مصاعد - مؤسسة شموس للمصاعد",
    "",
    `اسم الجهة / المبنى: ${formData.get("entity")}`,
    `المدينة: ${formData.get("city")}`,
    `عدد المصاعد: ${formData.get("elevators")}`,
    `اسم المسؤول: ${formData.get("contact")}`,
    `رقم الجوال: ${formData.get("phone")}`,
    `ملاحظات إضافية: ${notes}`,
  ].join("\n");
};

if (contractForm && formMessage) {
  contractForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!contractForm.checkValidity()) {
      formMessage.textContent = "يرجى تعبئة الحقول المطلوبة والتأكد من صحة رقم الجوال.";
      formMessage.classList.add("error");
      contractForm.reportValidity();
      return;
    }

    const content = getSiteContent();
    const formData = new FormData(contractForm);
    const message = buildRequestMessage(formData);
    const number = normalizeWhatsappNumber(content.whatsappNumber || "");
    const whatsappUrl = number
      ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    formMessage.textContent = "تم تجهيز الطلب. سيتم تحويلك إلى واتساب الآن لإرساله.";
    formMessage.classList.remove("error");
    contractForm.reset();
    window.location.href = whatsappUrl;
  });
}
