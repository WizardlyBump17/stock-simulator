const URL = 'https://query2.finance.yahoo.com/v8/finance/chart'

export async function getData(company, start, end, extra) {
    const fullUrl = `${URL}/${company}?period1=${start}&period2=${end}${!extra ? '' : `&${extra}`}`;
    const result = await (await fetch(fullUrl)).json()

    const tradingPeriods = result.chart.result[0].meta.tradingPeriods
    if (!tradingPeriods)
        return result

    const lastPeriod = tradingPeriods.pop()

    const toRemove = {
        start: lastPeriod.start,
        end: lastPeriod.end
    }

    const timestamp = result.chart.result[0].timestamp
    const quote = result.chart.result[0].indicators.quote[0]

    for (let i = 0; i < timestamp.length; i++) {
        if (timestamp[i] < toRemove.start || timestamp[i] > toRemove.end)
            continue

        timestamp.splice(i, 1)
        quote.open.splice(i, 1)
        quote.close.splice(i, 1)
        quote.high.splice(i, 1)
        quote.low.splice(i, 1)
        quote.volume.splice(i, 1)
    }

    return result
}
