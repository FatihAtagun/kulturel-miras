const links = document.querySelectorAll(".main-nav a");
const actionButtons = document.querySelectorAll(".header-actions button");

links.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    links.forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});

actionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    actionButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  });
});
