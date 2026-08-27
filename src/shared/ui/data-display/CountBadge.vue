<template>
  <span class="count-badge"><slot></slot></span>
</template>

<style scoped>
.count-badge {
  min-width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #e9edf4;
  color: #5b6579;
  font-weight: 750;
}
</style>
