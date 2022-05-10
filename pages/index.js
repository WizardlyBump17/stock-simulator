import styles from '../styles/index.module.css'
import Script from 'next/script'

const CURRENCIES = {'BRL': 'R$', 'USD': '$'}
const _60_DAYS = 60 * 24 * 60 * 60
const _7_DAYS = 7 * 24 * 60 * 60
const _5_YEARS = 5 * 365 * 24 * 60 * 60
const VALID_ITERVALS = ['1m', '5m', '1d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max']

export default function Get(props) {
    return (<>
        <Script src="https://cdn.plot.ly/plotly-2.12.0.js" charset="utf-8"></Script>

        <form onSubmit={show} className={styles.form}>
            <label htmlFor="company">Company symbol</label>
            <input type="text" name="company" required/>

            <label htmlFor="from">From</label>
            <input type="datetime-local" name="from" required id="from" defaultValue="2022-03-18T12:25"/>

            <label htmlFor="to">To</label>
            <input type="datetime-local" name="to" required id="to" defaultValue="2022-04-12T12:40"/>

            <label htmlFor="actions">How many actions</label>
            <input type="number" placeholder="How many actions" name="actions" required id="actions" defaultValue="100" min="1"/>

            <label htmlFor="interval">Interval</label>
            <input type="text" placeholder="Interval" defaultValue="1m" name="interval" required id="interval"/>

            <button type="submit">Get</button>
        </form>

        <p style={{color: 'yellow'}} id="warning"></p>
        <p style={{color: 'red'}} id="error"></p>
        <div id={styles.result}></div>
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

    const interval = document.getElementById('interval').value
    if (!VALID_ITERVALS.includes(interval.toLowerCase())) {
        document.getElementById('error').innerHTML = `Invalid interval.<br>Valid intervals: <b>${VALID_ITERVALS.join(', ')}</b>`
        return
    }

    const actions = document.getElementById('actions').value
    const result = await get(event.target.company.value, actions, interval, from, to)

    if (result.error) {
        document.getElementById('error').innerHTML = `ERROR:<br>${result.error.code}.<br>${result.error.description}.`
        return
    }

    if (to - from >= _5_YEARS) 
        document.getElementById('warning').innerHTML = 'The range between the dates is too big. It will take a while to load the graphic and it may lag.'

    document.getElementById('error').innerHTML = ''
    document.getElementById(styles.result).innerHTML = `${result}`

    setTimeout(() => document.getElementById('warning').innerHTML = '', 5000)
}

async function get(symbol, actions, interval, start, end) {
    const now = fixDate(new Date())

    if (end > now)
        end = now

    if ((Math.abs(end - now) > _7_DAYS || end - start > _7_DAYS) && interval == '1m') 
        interval = '5m'
    if ((Math.abs(end - now) > _60_DAYS || end - start > _60_DAYS) && (interval == '1m' || interval == '5m')) 
        interval = '1d'

    const data = await (await fetch(`/api/get_data?company=${symbol}&start=${start}&end=${end}&interval=${interval}`)).json()

    if (data.chart.error)
        return {error: data.chart.error}

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
            <div id="${styles.graphic}"></div>
            ${showPrices(symbol, timestamp, json.indicators.quote[0], interval, currency)}
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

function showPrices(company, timestamp, quote, interval, currency) {
    setTimeout(() => {
        const trace = {
            type: 'scatter',
            mode: 'lines',
            x: timestamp.map(t => t * 1000),
            y: quote.close,
            line: {
                color: '#00ff00'
            },
            hovertemplate: timestamp.map((t, i) => currency + format(quote.close[i]) + '<extra></extra>'),
            showlegend: false
        }

        const fixedClose = reverseArray(quote.close)
        const layout = {
            title: `${company} Historical Price`,
            xaxis: {
                range: [timestamp[0] * 1000, timestamp[timestamp.length - 1] * 1000],
                type: 'date',
                rangebreaks: [
                    {
                        pattern: 'hour',
                        bounds: [18, 10]
                    },
                    {
                        pattern: 'day of week',
                        bounds: [6, 1]
                    }
                ]
            },
            yaxis: {
                range: [fixedClose[0], fixedClose[fixedClose.length - 1]],
                type: 'linear',
                autorange: true
            },
            hovermode: 'x'
        }

        if (VALID_ITERVALS.indexOf(interval) >= VALID_ITERVALS.indexOf('1mo')) 
            layout.xaxis.rangebreaks = undefined

        console.log(timestamp.length)

        Plotly.newPlot(styles.graphic, [trace], layout)
    })
    return ''
}

function reverseArray(array) {
    let newArray = []
    for (let i = array.length - 1; i >= 0; i--)
        newArray.push(array[i])
    return newArray
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

function format(number) {
    return number.toLocaleString('pt-BR', {maximumFractionDigits: 2, minimumFractionDigits: 2})
}

function fixDate(date) {
    date.setUTCMilliseconds(0)
    date.setUTCSeconds(0)
    date.setUTCMinutes(0)
    date.setUTCHours(0)
    return date.getTime() / 1000
}