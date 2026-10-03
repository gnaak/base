// 안내 문서 공통 동작 — 사진 자리 · 복사 버튼
//
// 사진: <figure class="shot" data-shot="03-docker-2.png" data-what="무엇을 찍으면 되는지">
//   img/03-docker-2.png 가 있으면 그 사진을 보여 주고, 없으면 "무엇을 찍으면 되는지" 를 점선 상자로 보여 준다.
//   그래서 사진을 넣을 때 HTML 을 고칠 필요가 없다 — 그 이름으로 img/ 에 넣기만 하면 된다.
document.querySelectorAll("figure.shot[data-shot]").forEach((figure) => {
  const name = figure.dataset.shot;
  const what = figure.dataset.what || "";
  const img = new Image();
  img.alt = what;
  img.onload = () => {
    figure.prepend(img);
  };
  img.onerror = () => {
    const todo = document.createElement("div");
    todo.className = "shot-todo";
    todo.innerHTML = `📷 <b>사진 자리</b> — <code>docs/guides/img/${name}</code><br>`;
    todo.append(document.createTextNode(what));
    figure.prepend(todo);
  };
  img.src = `img/${name}`;
});

// 명령 상자마다 복사 버튼
document.querySelectorAll("pre > code").forEach((code) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy";
  button.textContent = "복사";
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code.innerText.trim());
      button.textContent = "복사됨";
    } catch {
      button.textContent = "직접 선택해 복사";
    }
    setTimeout(() => (button.textContent = "복사"), 1500);
  });
  code.parentElement.append(button);
});
