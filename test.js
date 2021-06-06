const http = require('http')

const data =
JSON.stringify({
  login: 'user1',
  password: 'password1',
})

const options = {
  hostname: 'localhost',
  port: 80,
  path: '/get_token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`)

  res.on('data', d => {
    process.stdout.write(d)
  })
})

req.on('error', error => {
  console.error(error)
})

req.write(data)
req.end()
