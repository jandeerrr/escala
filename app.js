// 🔥 FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCtOYelfW1Kq2lLbH0aoRbUCqnVuol6vvQ",
  authDomain: "cadastro-c2424.firebaseapp.com",
  projectId: "cadastro-c2424",
  storageBucket: "cadastro-c2424.appspot.com",
  messagingSenderId: "998940077034",
  appId: "1:998940077034:web:cd973356c273653346e093"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const menuAuth = document.getElementById("menuAuth");


const areaAdmin = document.getElementById("areaAdmin");
const diasSemanaDiv = document.getElementById("diasSemana");
const historicoDiv = document.getElementById("historico");
const btnLimpar = document.getElementById("btnLimpar");
const btnShareFloat = document.getElementById("btnShareFloat");

let recepcionistas = [];
let escalaAtual = {};
let imagemParaCompartilhar = "";

// ================= AUTH =================
auth.onAuthStateChanged(async user => {
  const btnLogout = document.getElementById("btnLogoutTopo");

  if (!user) {
    menuAuth.style.display = "block";
    areaAdmin.style.display = "none";
    btnLimpar.style.display = "none";
    btnShareFloat.style.display = "none";
    if (btnLogout) btnLogout.style.display = "none";
    return;
  }

  const doc = await db.collection("users").doc(user.uid).get();

  if (!doc.exists || doc.data().role !== "admin") {
    alert("Apenas administradores.");
    auth.signOut();
    return;
  }

  menuAuth.style.display = "none";
  areaAdmin.style.display = "block";
  btnLimpar.style.display = "inline-block";
  btnShareFloat.style.display = "block";
  if (btnLogout) btnLogout.style.display = "inline-block";

  atualizarTituloMes();
  await carregarRecepcionistas();
  await carregarEscala();
  montarDiasSemana();
});




// ================= ADMIN =================
async function cadastrarAdmin() {
  const nomeClinica = document.getElementById("nomeAdmin").value;
  const emailInput = document.getElementById("email").value;
  const senhaInput = document.getElementById("senha").value;

  if (!nomeClinica || !emailInput || !senhaInput) return alert("Preencha tudo");

  const userCred = await auth.createUserWithEmailAndPassword(emailInput, senhaInput);

  await db.collection("users").doc(userCred.user.uid).set({
    role: "admin",
    nomeClinica,
    criadoEm: new Date()
  });

  alert("Admin criado!");
  auth.signOut();
}

function login(){
  const emailInput = document.getElementById("email").value;
  const senhaInput = document.getElementById("senha").value;
  auth.signInWithEmailAndPassword(emailInput, senhaInput).catch(e=>alert(e.message));
}
function logout(){ auth.signOut() }
function recuperarSenha(){
  const emailInput = document.getElementById("email").value;
  auth.sendPasswordResetEmail(emailInput).then(()=>alert("Email enviado"));
}

// ================= RECEPCIONISTAS =================
async function cadastrar() {
  const user = auth.currentUser;
  const nome = nomeRecep.value;
  const foto = fotoRecep.files[0];
  if (!nome || !foto) return alert("Nome e foto!");

  const ref = storage.ref("recepcionistas/" + Date.now() + "_" + foto.name);
  await ref.put(foto);
  const fotoURL = await ref.getDownloadURL();

  await db.collection("users").doc(user.uid).update({
    recepcionistas: firebase.firestore.FieldValue.arrayUnion({ nome, fotoURL })
  });

  nomeRecep.value = "";
  fotoRecep.value = "";
  carregarRecepcionistas().then(montarDiasSemana);
}

async function carregarRecepcionistas() {
  const doc = await db.collection("users").doc(auth.currentUser.uid).get();
  recepcionistas = doc.data().recepcionistas || [];
  renderizarListaRecepcionistas(); // 👈 atualiza lista visual
}

// ================= ESCALA =================
function montarDiasSemana() {
  diasSemanaDiv.innerHTML = "";

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();

  for (let dia = 1; dia <= ultimoDia; dia++) {
    const data = new Date(ano, mes, dia);
    const nomeDia = data.toLocaleDateString("pt-BR", { weekday: "short" });

    const box = document.createElement("div");
    box.className = "card";
    box.innerHTML = `<h3>${dia} (${nomeDia})</h3>`;

    recepcionistas.forEach(r => {
      const chk = document.createElement("input");
      chk.type = "checkbox";

      const hora = document.createElement("input");
hora.type = "time";
hora.disabled = true;
hora.value = "00:00"; // 👈 ISSO SUBSTITUI O --:--


      chk.onchange = () => {
        hora.disabled = !chk.checked;
        const chave = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;



        if (!escalaAtual[chave]) escalaAtual[chave] = [];

        if (chk.checked) {
          escalaAtual[chave].push({ nome: r.nome, hora: hora.value || "08:00" });
        } else {
          escalaAtual[chave] = escalaAtual[chave].filter(p => p.nome !== r.nome);
        }
        salvarEscalaAtual();
      };

      hora.onchange = () => {
        const chave = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;

        const p = escalaAtual[chave]?.find(x => x.nome === r.nome);
        if (p) p.hora = hora.value;
        salvarEscalaAtual();
      };

      box.appendChild(chk);
      box.append(" " + r.nome + " ");
      box.appendChild(hora);
      box.appendChild(document.createElement("br"));
    });

    diasSemanaDiv.appendChild(box);
  }
}

async function salvarEscalaAtual() {
  const uid = auth.currentUser.uid;

  // 🔹 Pega dados do admin (nome da clínica)
  const userDoc = await db.collection("users").doc(uid).get();
  const dadosAdmin = userDoc.data();

  // 🔹 Salva escala no perfil do admin (privado)
  await db.collection("users").doc(uid).update({ escalaAtual });

  // 🔹 Salva escala pública (para a página compartilhada)
  await db.collection("escalasPublicas").doc(uid).set({
    nomeClinica: dadosAdmin.nomeClinica || "Sem nome",
    escala: escalaAtual,
    recepcionistas: recepcionistas,
    atualizadoEm: new Date()
  });

  carregarEscala();
}


async function carregarEscala(){
  const doc = await db.collection("users").doc(auth.currentUser.uid).get();
  escalaAtual = doc.data().escalaAtual || {};
  historicoDiv.innerHTML = "";

  // 🗓️ Ordena os dias corretamente como data
  const diasOrdenados = Object.keys(escalaAtual)
    .sort((a, b) => new Date(a) - new Date(b));

  diasOrdenados.forEach(dia => {

    const dataObj = new Date(dia);
    const dataFormatada = dataObj.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

    const div = document.createElement("div");
    div.innerHTML = `<h4>📅 ${dataFormatada}</h4>`;

    // ⏰ Ordena horários dentro do dia
    escalaAtual[dia]
      .sort((a, b) => {
        const [hA, mA] = a.hora.split(":").map(Number);
        const [hB, mB] = b.hora.split(":").map(Number);
        return (hA * 60 + mA) - (hB * 60 + mB);
      })
      .forEach(p => {
        const r = recepcionistas.find(x => x.nome === p.nome);
        if (!r) return;

        div.innerHTML += `
          <div class="recepcionista-card">
            <img src="${r.fotoURL}">
            <strong>${p.hora}</strong> — ${p.nome}
          </div>
        `;
      });

    historicoDiv.appendChild(div);
  });
}

async function limparEscala() {
  if (!confirm("Apagar escala?")) return;
  const user = auth.currentUser;
  escalaAtual = {};
  await db.collection("users").doc(user.uid).update({ escalaAtual: {} });
  await db.collection("escalasPublicas").doc(user.uid).delete();
  carregarEscala();
}

// ================= COMPARTILHAR =================
async function compartilharEscala() {
  const user = auth.currentUser;
  if (!user) return alert("Faça login primeiro");
  if (!escalaAtual || Object.keys(escalaAtual).length === 0)
    return alert("Nenhuma escala criada.");

  await db.collection("escalasPublicas").doc(user.uid).set({
    escala: escalaAtual,
    recepcionistas,
    atualizadoEm: new Date()
  });

  const link = `${window.location.origin}/escala?uid=${user.uid}`;

  if (navigator.share) {
    navigator.share({
      title: "Escala do Mês",
      text: "Segue a escala atualizada 📅",
      url: link
    });
  } else {
    prompt("Copie o link da escala:", link);
  }
}

// ================= MÊS AUTOMÁTICO =================
function atualizarTituloMes() {
  const meses = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ];
  const hoje = new Date();
  document.getElementById("tituloMes").innerText =
    `📆 Escala de ${meses[hoje.getMonth()]} ${hoje.getFullYear()}`;
}

//função deletar recepicionista//
async function deletarRecepcionista(nome, fotoURL) {
  const user = auth.currentUser;
  if (!user) return;

  if (!confirm(`Remover ${nome}?`)) return;

  // 🔥 Remove do Firestore
  await db.collection("users").doc(user.uid).update({
    recepcionistas: firebase.firestore.FieldValue.arrayRemove({ nome, fotoURL })
  });

  // 🔥 Remove a foto do Storage
  try {
    const ref = storage.refFromURL(fotoURL);
    await ref.delete();
  } catch (e) {
    console.warn("Foto não encontrada no storage");
  }

  await carregarRecepcionistas();
  montarDiasSemana();
  alert("Recepcionista removida");
}
//Função renderizar recepicionista//
function renderizarListaRecepcionistas() {
  const lista = document.getElementById("listaRecepcionistas");
  if (!lista) return; // evita erro se a div não existir

  lista.innerHTML = "";

  recepcionistas.forEach(r => {
    const div = document.createElement("div");
    div.className = "recepcionista-card";

    div.innerHTML = `
      <img src="${r.fotoURL}">
      <span>${r.nome}</span>
      <button onclick="deletarRecepcionista('${r.nome}','${r.fotoURL}')"
        style="margin-left:auto;background:#ff4d4d;color:white;border:none;border-radius:20px;padding:4px 10px;cursor:pointer">
        Excluir
      </button>
    `;

    lista.appendChild(div);
  });
}
function toggleListaRecep(){
  const lista = document.getElementById("listaRecepcionistas");
  lista.classList.toggle("escondido");
}
