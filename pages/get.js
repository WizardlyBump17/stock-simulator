const CURRENCIES = {'BRL': 'R$', 'USD': '$'}

export default function (props) {
    return (<>
        <form onSubmit={show}>
            <input type="text" name="company" required/>

            <input type="datetime-local" name="from" required id="from" defaultValue="2022-03-18T12:25"/>
            <input type="datetime-local" name="to" required id="to" defaultValue="2022-04-12T12:40"/>
            <input type="number" placeholder="How many actions" name="actions" required id="actions" defaultValue="70"/>

            <button type="submit">Get</button>
        </form>

        <p id="status"></p>
        <div id="result"></div>
    </>)
}

async function show(event) {
    event.preventDefault()

    document.getElementById('status').innerHTML = 'Loading...'

    const from = new Date(document.getElementById('from').value).getTime() / 1000
    const to = new Date(document.getElementById('to').value).getTime() / 1000
    const actions = document.getElementById('actions').value
    const result = await get(event.target.company.value, actions, '5m', from, to)

    document.getElementById('result').innerHTML = `${result}`

    document.getElementById('status').innerHTML = 'Done!'
    setTimeout(() => {
        document.getElementById('status').innerHTML = ''
    }, 3000)
}

async function get(symbol, actions, interval='1m', start=fixDate(new Date()), end=fixDate(new Date())) {
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

    const diff = close[close.length - 2] - close[0]
    const profit = getPercentage(close[0], close[close.length - 2])

    let currency;
    if (CURRENCIES[json.meta.currency])
        currency = CURRENCIES[json.meta.currency]
    else
        currency = '$'

    return `
        <h1>${symbol.includes('.') ? symbol.substring(0, symbol.indexOf('.')) : symbol}</h1>
        <h2>${profit >= 0 ? '+' : ''}${format(profit)}% (${currency + format(diff)}) ${actions} Actions</h2>
        <h3>1 Action = ${currency + format(close[0])}</h3>
        <h3>You spent ${currency + format(close[0] * actions)} and finished with ${currency + format(multiply(close[0] * actions, profit))}</h3>
        <ul>
            <h3>Price</h3>
            ${showPrices(timestamp, close, currency, 1)}
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

function showPrices(timespamp, close, currency, depth=5) {
    let result = ''
    let lastDay = new Date(timespamp[timespamp.length - 1] * 1000).getUTCDay()
    for (let i = timespamp.length - 1; i >= 0; i -= depth) {
        const date = new Date(timespamp[i] * 1000);
        const day = date.getUTCDay()

        if (day !== lastDay) 
            result += '<br/><br/>'

        if (close[i] == null) {
            result += `<li key=${timespamp[i]}><span>${date.toLocaleString('pt-BR')}</span> | <span>No data, maybe it is the latest price</span></li>`
            lastDay = day;
            continue
        }
        
        result += `<li key=${timespamp[i]}><span>${date.toLocaleString('pt-BR')}</span> | <span>${currency + format(close[i])}</span></li>`

        lastDay = day;
    }
    return result
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
    return number.toLocaleString('pt-BR', {maximumFractionDigits: 2, minimumFractionDigits: 0})
}

function fixDate(date) {
    date.setUTCMilliseconds(0)
    date.setUTCSeconds(0)
    date.setUTCMinutes(0)
    date.setUTCHours(0)
    return date.getTime() / 1000
}