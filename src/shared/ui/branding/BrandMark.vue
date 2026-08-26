<template>
  <span class="brand-mark" aria-hidden="true"><i></i></span>
</template>

<style scoped>
.brand-mark {
  position: relative;
  width: 42px;
  height: 42px;
  display: grid;
  overflow: hidden;
  place-items: center;
  border-radius: 15px;
  background: linear-gradient(145deg, var(--brand-deep), var(--brand-strong));
  box-shadow: 0 10px 24px rgba(16, 45, 44, 0.24);
}

.brand-mark::before {
  content: '';
  width: 25px;
  height: 11px;
  border: 3px solid var(--accent);
  border-top: 0;
  border-left-color: transparent;
  border-radius: 50%;
  transform: rotate(-15deg);
}

.brand-mark i {
  position: absolute;
  right: 8px;
  top: 13px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ffd06e;
  box-shadow: 0 0 0 4px rgba(255, 208, 110, 0.12);
}
</style>
