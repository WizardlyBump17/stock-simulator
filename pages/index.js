import styles from '../styles/index.module.css'

const CURRENCIES = {'BRL': 'R$', 'USD': '$'}
const CANVAS_WIDTH = 1000
const CANVAS_HEIGHT = 300
const _60_DAYS = 60 * 24 * 60 * 60
const _7_DAYS = 7 * 24 * 60 * 60
const CIRCLE_RADIUS = 3

export default function Get(props) {
    return (<>
        <form onSubmit={show} className={styles.form}>
            <label htmlFor="company">Company symbol</label>
            <input type="text" name="company" required/>

            <label htmlFor="from">From</label>
            <input type="datetime-local" name="from" required id="from" defaultValue="2022-03-18T12:25"/>

            <label htmlFor="to">To</label>
            <input type="datetime-local" name="to" required id="to" defaultValue="2022-04-12T12:40"/>

            <label htmlFor="actions">How many actions</label>
            <input type="number" placeholder="How many actions" name="actions" required id="actions" defaultValue="100" min="1"/>

            <button type="submit">Get</button>
        </form>

        <div id={styles.result}></div>
        <p style={{color: 'red'}} id="error"></p>
    </>)
}

async function show(event) {
    event.preventDefault()

    const from = new Date(document.getElementById('from').value).getTime() / 1000
    const to = new Date(document.getElementById('to').value).getTime() / 1000

    if (from >= to) {
        document.getElementById('error').innerHTML = 'Invalid dates. <b>from</b> must be before <b>to</b>'
        return
    }

    const actions = document.getElementById('actions').value
    const result = await get(event.target.company.value, actions, undefined, from, to)

    document.getElementById(styles.result).innerHTML = `${result}`
}

async function get(symbol, actions, interval='1m', start=fixDate(new Date()), end=fixDate(new Date())) {
    const now = fixDate(new Date())

    if (end > now)
        end = now

    if (Math.abs(end - now) > _7_DAYS || end - start > _7_DAYS) 
        interval = '5m'
    if (Math.abs(end - now) > _60_DAYS || end - start > _60_DAYS) 
        interval = '1d'

    const data = await (await fetch(`/api/get_data?company=${symbol}&start=${start}&end=${end}&interval=${interval}`)).json()

    const json = data.chart.result[0]

    let timestamp = json.timestamp
    let close = json.indicators.quote[0].close

    if (!close) {
        timestamp = [json.meta.regularMarketTime]
        close = [json.meta.regularMarketPrice]
    }

    if (close == null)
        close = [json.meta.regularMarketPrice]

    close = fixArray(close, firstNonNull(close))

    const diff = close[close.length - 1] - close[0]
    const profit = getPercentage(close[0], close[close.length - 1])

    let currency;
    if (CURRENCIES[json.meta.currency])
        currency = CURRENCIES[json.meta.currency]
    else
        currency = '$'

    return `
        <h1>${symbol.includes('.') ? symbol.substring(0, symbol.indexOf('.')) : symbol}</h1>
        <h2>${profit >= 0 ? '+' : ''}${format(profit)}% (${currency + format(close[0])} ➜ ${currency + format(close[close.length - 1])}, ${(diff >= 0 ? '+' : '') + currency + format(diff)})</h2>
        <h3>1 Action = ${currency + format(close[0])}</h3>
        <h3>You spent ${currency + format(close[0] * actions)} and finished with ${currency + format(multiply(close[0] * actions, profit))} (${currency + format(close[0] * actions * (profit / 100))})</h3>
        <ul class=${styles.prices}>
            <h3>Price</h3>
            <canvas id=${styles.graphic} width="${CANVAS_WIDTH}px" height="${CANVAS_HEIGHT}px"></canvas>
            ${showPrices(timestamp, close, currency, 1)}
            <div id=${styles.rects}></div>
            <span id='dot'></span>
        </ul>
    `
}

function firstNonNull(array) {
    for (let i = 0; i < array.length; i++) 
        if (array[i] != null)
            return array[i]
    return null
}

function multiply(value, percentage) {
    return value + value * (percentage / 100)
}

function showPrices(timestamp, close, currency) {
    setTimeout(() => {
        const rects = document.getElementById(styles.rects)

        let canvas = document.getElementById(styles.graphic)
        let context = canvas.getContext('2d')
    
        context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        context.beginPath()
    
        const higher = getHiger(close)
        const x = 0
        const xStep = CANVAS_WIDTH / timestamp.length

        let lastClose = close[0]
        for (let i = 0; i < timestamp.length; i++) {

            const date = new Date(timestamp[i] * 1000);
            const y = CANVAS_HEIGHT / 2 + CANVAS_HEIGHT - (close[i] / higher * CANVAS_HEIGHT)

            context.lineTo(x, y)
            context.lineWidth = 2
            context.strokeStyle = close[i] >= lastClose ? 'green' : 'red'
            context.stroke()
            context.beginPath()
            context.moveTo(x, y)

            rects.appendChild(createRect(x, y, xStep * 2, CANVAS_HEIGHT, date.toLocaleString() + ' ' + currency + format(close[i]), canvas, close[i] >= lastClose ? 'green' : 'red'))

            lastClose = close[i]

            x += xStep
        }
    })
    return ''
}

function createRect(x, y, width, height, html, canvas, color) {
    const rect = document.createElement('div')
    const dot = document.getElementById('dot')

    rect.className = styles.rect
    rect.style.position = 'absolute'
    rect.style.left = canvas.getBoundingClientRect().left + x + 'px'
    rect.style.top = canvas.getBoundingClientRect().top - window.screenY + 'px'
    rect.style.width = width + 'px'
    rect.style.height = height + 'px'
    rect.innerHTML = html
    rect.style.opacity = 0
    rect.style.color = color

    rect.onmouseover = () => {
        rect.style.opacity = 1
    }
    rect.onmouseout = () => {
        rect.style.opacity = 0
    }

    return rect
}

function fixArray(array, first) {
    let last = first;
    for (let i = 0; i < array.length; i++) {
        if (array[i] == null) 
            array[i] = last;
        else 
            last = array[i];
    }
    return array;
}

function getPercentage(intial, final) {
    return ((final - intial) / intial) * 100
}

function getHiger(array) {
    let higher = array[0]
    for (let i = 1; i < array.length; i++) {
        if (array[i] > higher)
            higher = array[i]
    }
    return higher
}

function format(number) {
    return number.toLocaleString('pt-BR', {maximumFractionDigits: 2, minimumFractionDigits: 0})
}

function fixDate(date) {
    date.setUTCMilliseconds(0)
    date.setUTCSeconds(0)
    date.setUTCMinutes(0)
    date.setUTCHours(0)
    return date.getTime() / 1000
}