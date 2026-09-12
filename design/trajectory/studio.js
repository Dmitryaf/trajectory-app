/* global document, URLSearchParams, location, history */
const settings = { direction: 'all', screen: 'landing', data: 'full', viewport: 'mobile' };
const params = new URLSearchParams(location.search);
const canvasOnly = params.get('canvas') === '1';
document.body.classList.toggle('canvas-only', canvasOnly);
for (const key of Object.keys(settings)) {
  const select = document.getElementById(key);
  if ([...select.options].some((option) => option.value === params.get(key))) {
    settings[key] = params.get(key);
  }
  select.value = settings[key];
  select.addEventListener('change', () => {
    settings[key] = select.value;
    updateUrl();
    render();
  });
}
const names = {
  a: 'A · Current Evolved',
  b: 'B · Warm Editorial',
  c: 'C · Dark Reflective',
  b1: 'B1 · Editorial Pure',
  b2: 'B2 · Warm Organic',
  b3: 'B3 · Atmospheric Editorial',
  b4: 'B4 · Reflective Journal',
};
const warmVariants = ['b1', 'b2', 'b3', 'b4'];
let historyRange = 'all';
function updateUrl() {
  const query = new URLSearchParams(settings);
  if (canvasOnly) query.set('canvas', '1');
  history.replaceState(null, '', '?' + query);
}
document.querySelectorAll('[data-direction]').forEach((button) => {
  button.addEventListener('click', () => {
    settings.direction = button.dataset.direction;
    document.getElementById('direction').value = settings.direction;
    updateUrl();
    render();
  });
});
const titles = { landing: 'Landing', today: 'Сегодня', week: 'Неделя', history: 'История' };
const brand = `<span class="wordmark"><svg class="brand-path" viewBox="0 0 28 32" fill="none" aria-hidden="true"><path d="M4 28V20C4 14 23 17 23 9V3M4 28L1 24M23 3L26 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>Траектория</span>`;
const series = () => (settings.data === 'full' ? [3, 4, 2, 3, 4, null, 4] : [3, null, null, null, 4, null, null]);
const average = (values) => {
  const known = values.filter((value) => value !== null);
  return known.length ? (known.reduce((a, b) => a + b, 0) / known.length).toFixed(1).replace('.', ',') : '—';
};
const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
function chart(id) {
  const values = series();
  const n = values.filter((v) => v !== null).length;
  return `<p class="legend">Энергия · шкала 1–5 · n = ${n} из 7 дней<br>● Записанное значение &nbsp; — Нет записи; это не ноль</p>
  <svg class="chart" viewBox="0 0 520 208" role="group" aria-label="Энергия по дням, шкала от 1 до 5">
  ${[1, 2, 3, 4, 5].map((v) => `<line class="grid" x1="35" x2="503" y1="${174 - (v - 1) * 36}" y2="${174 - (v - 1) * 36}"/><text x="10" y="${178 - (v - 1) * 36}">${v}</text>`).join('')}
  ${values
    .map((v, i) => {
      const x = 52 + i * 72;
      return (
        `<text text-anchor="middle" x="${x}" y="202">${days[i]}</text>` +
        (v === null
          ? `<path class="missing" d="M${x - 6} 174h12"/><text class="missing-label" text-anchor="middle" x="${x}" y="160">нет</text>`
          : `<circle tabindex="0" role="img" aria-label="${days[i]}: энергия ${v} из 5" data-tooltip="${days[i]} · энергия ${v} из 5 · собственная оценка, без интерпретации" cx="${x}" cy="${174 - (v - 1) * 36}" r="6"><title>${days[i]}: ${v} из 5</title></circle>`)
      );
    })
    .join('')}</svg>
  <div class="tooltip" id="tooltip-${id}" role="status">Выберите точку мышью или клавишей Tab.</div>
  <details><summary>Данные графика таблицей</summary><table><caption>Энергия, 7–13 сентября</caption><thead><tr><th>День</th><th>Значение</th></tr></thead><tbody>${values.map((v, i) => `<tr><td>${days[i]}</td><td>${v === null ? 'Нет записи' : v + ' из 5'}</td></tr>`).join('')}</tbody></table></details>`;
}
function example() {
  const partial = settings.data === 'partial';
  return `<aside class="example"><p class="eyebrow">Одна неделя · пример</p><p><strong>7–13 сентября</strong></p><p class="quote">«Казалось, ничего<br>не произошло»</p><div class="fact">Завершён первый черновик статьи<small>Результат · пятница</small></div>${partial ? '' : '<div class="fact">Прогулка с сестрой у реки<small>Событие · воскресенье</small></div>'}<div class="fact">Энергия ${average(series())} из 5<small>По ${series().filter((v) => v !== null).length} записям из 7 дней. Остальное неизвестно.</small></div><p class="muted" style="margin:18px 0 0">Этого достаточно, чтобы вспомнить конкретные моменты. Что они значат для вас — решаете вы.</p></aside>`;
}
function productPreviews(id) {
  return `<section class="section product-previews"><h2>Записи, обзор, история</h2><p class="muted">Один и тот же вымышленный период на трёх экранах.</p><div class="preview-grid">${['today', 'week', 'history'].map((screen) => `<figure><a href="#" data-screen="${screen}"><img src="previews/${id}-${screen}.jpg" width="560" height="700" alt="${titles[screen]}: пример экрана Траектории" loading="lazy"></a><figcaption>${titles[screen]}</figcaption></figure>`).join('')}</div></section>`;
}
function landing(id) {
  return `<header class="topbar">${brand}<a class="login" href="#" data-demo="В будущем — отдельный экран входа. Сейчас это дизайн-концепт.">Войти</a></header><div class="content">
  <section class="hero"><div><p class="eyebrow">Личные записи · взгляд на период</p><h1>Неделя была.<br>Что в ней осталось?</h1><p class="lead">Иногда кажется, что ничего не произошло. Короткие записи помогают вспомнить результаты, события и своё состояние — и увидеть период полнее.</p><div class="actions"><a class="button" href="#" data-demo="Попробовать: создать аккаунт → подтвердить email → войти → по желанию восстановить прошедшую неделю.">Попробовать</a><a href="#example-${id}" data-example>Посмотреть пример ↓</a></div><small class="caption">Начать с аккаунта. Ежедневные записи необязательны.</small></div>${example()}</section>
  <section class="section" id="example-${id}"><p class="eyebrow">От записи к собственному пониманию</p><h2>Без необходимости<br>оценивать всю жизнь</h2><div class="steps"><div><span class="step-number">01 / ЗАПИСАТЬ</span><h3>Оставьте то, что важно</h3><p class="muted">Результат, событие или состояние. Любые поля можно пропустить.</p></div><div><span class="step-number">02 / УВИДЕТЬ</span><h3>Вернитесь к периоду</h3><p class="muted">Посмотрите записи рядом. Пропуски останутся пропусками.</p></div><div><span class="step-number">03 / ОСМЫСЛИТЬ</span><h3>Сделайте свой вывод</h3><p class="muted">Можно записать наблюдение или решение. Можно просто вспомнить.</p></div></div></section>
  <section class="section privacy"><div><p class="eyebrow">Ваши записи</p><h2>Вы выбираете,<br>чем делиться</h2></div><div><p>Записи можно выгрузить. Аккаунт и связанные данные можно удалить в Настройках.</p><p>Статистика использования — только с разрешения, без содержимого записей. Передача во внешнюю нейросеть — вручную, по вашему выбору.</p><p class="muted">В аккаунте записи синхронизируются с сервером. Условия обработки и сведения об операторе будут доступны до регистрации.</p></div></section>
  ${warmVariants.includes(id) ? productPreviews(id) : ''}<section class="section"><h2>Можно начать<br>с прошедшей недели</h2><p>Вспомните один момент. Этого достаточно для первой записи.</p><a class="button" href="#" data-demo="Следующий шаг — регистрация. Здесь аккаунт не создаётся.">Попробовать</a><p class="demo-status" role="status"></p></section><footer class="footer"><span>Траектория</span><span>Концепт публичного входа</span><span>Пример составлен из вымышленных записей</span></footer></div>`;
}
function shell(screen, body) {
  return `<header class="topbar">${brand}<a class="login" href="#" data-demo="Настройки в концепте не подключены к аккаунту.">Настройки</a></header><nav class="appnav" aria-label="Разделы концепта">${[
    ['today', 'Сегодня'],
    ['week', 'Обзор'],
    ['history', 'История'],
  ]
    .map(([key, label]) => `<a href="#" data-screen="${key}" ${key === screen ? 'aria-current="page"' : ''}>${label}</a>`)
    .join(
      '',
    )}<a href="#" data-demo="Журнал остаётся отдельным разделом будущего приложения.">Журнал</a></nav><div class="content">${body}<p class="demo-status" role="status"></p><footer class="footer"><span>Все данные вымышлены</span><span>Концепт · ничего не сохраняется</span></footer></div>`;
}
function today(id) {
  const partial = settings.data === 'partial';
  return shell(
    'today',
    `<div class="page-heading"><div><p class="eyebrow">Суббота · 12 сентября</p><h1>Сегодня</h1><p class="muted">Можно записать только то, к чему хочется вернуться.</p></div><span class="date-picker">← &nbsp; 12.09.2026 &nbsp; →</span></div>
  <div class="columns"><form data-form class="block"><h2>Как проходит день</h2><p class="muted">Все поля необязательны.</p><div class="fields"><label class="field" for="energy-${id}">Энергия<input id="energy-${id}" type="number" min="1" max="5" placeholder="Не указана"><small>От 1 до 5 · без оценки дня</small></label><label class="field" for="sleep-${id}">Сон, часов<input id="sleep-${id}" type="number" min="0" max="24" step="0.5" value="${partial ? '' : '7.5'}" placeholder="Не указан"><small>Отдельное наблюдение</small></label></div><label class="field" for="note-${id}">Что хочется запомнить<textarea id="note-${id}" placeholder="Событие, результат или мысль">${partial ? '' : 'Разобрал заметки к статье. Заметил, что мне легче писать после прогулки. Пока это только впечатление.'}</textarea></label><button type="submit">Сохранить запись</button><p class="caption" style="margin-top:12px">В концепте сохранение только имитируется.</p></form>
  <aside><section class="block"><p class="eyebrow">Рядом с сегодняшним днём</p><h2>На этой неделе</h2><div class="record"><time>Пятница · результат</time><p>Завершён первый черновик статьи</p></div>${partial ? '' : '<div class="record"><time>Среда · событие</time><p>Встреча с друзьями после работы</p></div>'}<div class="record"><time>Данные периода</time><p>${series().filter((v) => v !== null).length} записей об энергии из 7 дней. По остальным дням данных нет.</p></div></section><p class="muted">Не нужно восстанавливать каждый день. Запись может быть короткой и неполной.</p></aside></div>`,
  );
}
function week(id) {
  const n = series().filter((v) => v !== null).length;
  const partial = settings.data === 'partial';
  return shell(
    'week',
    `<div class="page-heading"><div><p class="eyebrow">Обзор периода</p><h1>7–13 сентября</h1><p class="muted">Записи рядом. Значение происходившего — за вами.</p></div><span class="date-picker">← &nbsp; Неделя &nbsp; →</span></div>
  <div class="stats"><div class="stat"><strong>${n} / 7</strong><span>дней с записью об энергии</span></div><div class="stat"><strong>${average(series())}</strong><span>энергия · 1–5 · n = ${n}</span></div><div class="stat"><strong>1</strong><span>записанный результат</span></div></div>
  <div class="columns"><section class="block"><h2>Состояние по записям</h2>${chart(id)}</section><aside class="block"><h2>Что осталось в памяти</h2><div class="record"><time>11 сентября · результат</time><p>Завершён первый черновик статьи</p></div><div class="observation"><span class="kind">Наблюдение</span><p>В записанные дни энергия была от ${Math.min(...series().filter((v) => v !== null))} до 4 из 5.</p></div><div class="observation context"><span class="kind">Контекст</span><p>${partial ? 'Про события других дней пока нет записей.' : 'В среду была встреча с друзьями. Эта запись не объясняет изменение энергии.'}</p></div></aside></div>
  <section class="block"><h2>Сопоставление недель</h2><div class="table-wrap"><table><caption>Средняя энергия · шкала 1–5</caption><thead><tr><th>Период</th><th>Среднее</th><th>n / дней</th></tr></thead><tbody><tr><td>7–13 сентября</td><td>${average(series())}</td><td>${n} / 7</td></tr><tr><td>31 августа — 6 сентября</td><td>3,0</td><td>${partial ? 3 : 4} / 7</td></tr></tbody></table></div><div class="observation quality"><span class="kind">Данные</span><p>${partial ? 'Сравнение не сформировано: в группах 2 и 3 записи; для сопоставления нужно не меньше 4 записей в каждой группе.' : 'Средние относятся к разным наборам записанных дней: n = 6 и n = 4. Это описание выборок, без оценки недели и вывода о причинах.'}</p></div></section>
  <section class="block"><h2>Своими словами</h2><p class="reflection">${partial ? 'Пока хочется просто сохранить черновик статьи как один из моментов недели. По нескольким записям не получается вспомнить весь период. Можно вернуться к этому позже — или оставить как есть.' : 'В начале недели казалось, что всё время уходит на мелочи. Сейчас вижу законченный черновик и встречу, которую давно откладывал. В записях есть и усталость, и интерес. Не хочу сводить их к одной оценке. На следующей неделе попробую оставлять короткую заметку после работы, если будет желание.'}</p><button class="secondary" type="button" data-demo="Здесь будет редактирование обзора. Записи концепта не сохраняются.">Изменить обзор</button></section>`,
  );
}
function historyFilters(id) {
  return `<div class="history-filters"><label for="range-${id}">Периоды в таблице<select id="range-${id}" data-history-range><option value="all">10 августа — 13 сентября 2026</option><option value="september">Недели с днями сентября</option><option value="august">Недели только августа</option></select></label><p class="caption" data-filter-status role="status"></p></div>`;
}
function applyHistoryFilter() {
  document.querySelectorAll('.prototype').forEach((prototype) => {
    const select = prototype.querySelector('[data-history-range]');
    if (!select) return;
    select.value = historyRange;
    const rows = [...prototype.querySelectorAll('[data-period]')];
    for (const row of rows) {
      row.hidden = historyRange !== 'all' && row.dataset.period !== historyRange;
    }
    prototype.querySelector('[data-filter-status]').textContent =
      'Периодов в таблице: ' + rows.filter((row) => !row.hidden).length + ' из 5. Остальные разделы показывают исходный период.';
  });
}
function historyScreen(id) {
  const partial = settings.data === 'partial';
  const rows = [
    ['10–16 августа', '3,2', 5],
    ['17–23 августа', '2,8', 4],
    ['24–30 августа', '—', 0],
    ['31 авг. — 6 сент.', '3,0', partial ? 3 : 4],
    ['7–13 сентября', average(series()), partial ? 2 : 6],
  ];
  return shell(
    'history',
    `<div class="page-heading"><div><p class="eyebrow">История · август — сентябрь</p><h1>Периоды рядом</h1><p class="muted">Разная полнота записей остаётся видимой.</p></div><span class="date-picker">5 недель</span></div>${warmVariants.includes(id) ? historyFilters(id) : ''}<section class="block"><h2>Последняя неделя</h2>${chart(id)}</section><section class="block"><h2>Энергия по неделям</h2><div class="table-wrap"><table><caption>Средние собственных оценок · шкала 1–5; не оценка периода</caption><thead><tr><th>Неделя</th><th>Среднее</th><th>n / 7</th></tr></thead><tbody>${rows.map((row) => `<tr data-period="${row[0].includes('сент') ? 'september' : 'august'}"><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]} / 7</td></tr>`).join('')}</tbody></table></div><div class="observation quality"><span class="kind">Данные</span><p>24–30 августа нет записей об энергии. Пропуск не означает нулевую энергию или пустую неделю.</p></div></section><section class="block"><h2>К чему вернуться</h2><div class="record"><time>7–13 сентября · обзор</time><p class="reflection">Завершённый черновик помог вспомнить неделю конкретнее. Из этого не обязательно делать новое правило.</p></div><div class="record"><time>17–23 августа · решение</time><p>Оставить вечер среды без планов. Вернуться к этому в следующем обзоре.</p></div></section>`,
  );
}
function render() {
  const studio = document.getElementById('studio');
  const directions =
    settings.direction === 'all' ? warmVariants : settings.direction === 'historical' ? ['a', 'b', 'c'] : [settings.direction];
  studio.className = directions.length > 1 ? 'compare' : '';
  studio.style.setProperty('--comparison-count', directions.length);
  document
    .querySelectorAll('[data-direction]')
    .forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.direction === settings.direction)));
  studio.innerHTML = directions
    .map(
      (id) =>
        `<article class="frame ${settings.viewport === 'mobile' ? 'mobile' : ''}"><h2 class="concept-label">${names[id]} / ${titles[settings.screen]} / ${settings.data === 'full' ? 'заполнено' : 'частично'}</h2><div class="prototype ${warmVariants.includes(id) ? 'theme-b warm-variant' : ''} theme-${id} surface-${settings.screen}" data-concept="${id}">${settings.screen === 'landing' ? landing(id) : settings.screen === 'today' ? today(id) : settings.screen === 'week' ? week(id) : historyScreen(id)}</div></article>`,
    )
    .join('');
  studio.querySelectorAll('[data-history-range]').forEach((select) => {
    select.value = historyRange;
    select.addEventListener('change', () => {
      historyRange = select.value;
      applyHistoryFilter();
    });
  });
  applyHistoryFilter();
  studio.querySelectorAll('[data-tooltip]').forEach((point) => {
    const show = () => {
      point.closest('.block').querySelector('.tooltip').textContent = point.dataset.tooltip;
    };
    point.addEventListener('focus', show);
    point.addEventListener('pointerenter', show);
  });
  studio.querySelectorAll('[data-screen]').forEach((link) =>
    link.addEventListener('click', (event) => {
      event.preventDefault();
      settings.screen = link.dataset.screen;
      document.getElementById('screen').value = settings.screen;
      updateUrl();
      render();
    }),
  );
  studio.querySelectorAll('[data-demo]').forEach((button) =>
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const status = button.closest('.prototype').querySelector('.demo-status');
      status.textContent = button.dataset.demo;
      status.scrollIntoView({ block: 'nearest' });
    }),
  );
  studio.querySelectorAll('[data-example]').forEach((link) =>
    link.addEventListener('click', (event) => {
      event.preventDefault();
      link.closest('.prototype').querySelector('.example').scrollIntoView({ block: 'center' });
    }),
  );
  studio.querySelectorAll('[data-form]').forEach((form) =>
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      form.closest('.prototype').querySelector('.demo-status').textContent = 'Пример сохранения. Данные не отправлены и не записаны.';
    }),
  );
}
render();
