const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const app = express();

//middleWare
app.use(cors());
app.use(express.json());






const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.nfiuyyd.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

//JWT middleWare
function verifyJWT(req, res, next) {
    // console.log()
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access.')
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        const appointmentListOptionsCollection = client.db('doctorPortal').collection('appointmentList');
        const bookingCollections = client.db('doctorPortal').collection('bookingOptions');
        const usersCollections = client.db('doctorPortal').collection('users');
        const doctorsCollections = client.db('doctorPortal').collection('doctors');
        const paymentsCollection = client.db('doctorsPortal').collection('payments');




        const verifyAdmin = async (req, res, next) => {
            console.log(req.decoded.email);
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail }
            const user = await usersCollections.findOne(query)
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }





        //use aggregate to query multiple collection and then merge data
        app.get('/appointmentOption', async (req, res) => {
            const date = req.query.date;
            // console.log(date)
            const query = {};
            const options = await appointmentListOptionsCollection.find(query).toArray();
            const bookingQuery = { appointmentDate: date }
            const alreadyBooked = await bookingCollections.find(bookingQuery).toArray();
            //code carefully
            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name);
                const bookedSlots = optionBooked.map(book => book.slot)
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot));
                option.slots = remainingSlots;
            })
            res.send(options)
        })


        //post------------------------------------------
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const query = {
                appointmentDate: booking.appointmentDate,
                email: booking.email,
                treatment: booking.treatment
            }

            const alreadyBooked = await bookingCollections.find(query).toArray();

            if (alreadyBooked.length) {
                const message = `You already have a booking on ${booking.appointmentDate}`
                return res.send({ acknowledged: false, message })
            }

            const result = await bookingCollections.insertOne(booking);
            res.send(result);
        })


        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const bookings = await bookingCollections.findOne(query)
            res.send(bookings)
        })



        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden' })
            }
            const query = { email: email }
            const bookings = await bookingCollections.find(query).toArray()
            res.send(bookings)
        })



        //post user
        app.post('/users', async (req, res) => {
            const user = req.body
            const result = await usersCollections.insertOne(user)
            res.send(result)
        })
        //get user
        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollections.find(query).toArray();
            res.send(users)
        })

        //admin user check
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollections.findOne(query)
            res.send({ isAdmin: user?.role === 'admin' })
        })


        //JWT
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollections.findOne(query)
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
                return res.send({ accessToken: token })
            }
            console.log(user)
            res.status(403).send({ accessToken: '' })
        })




        //update
        app.put('/users/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {

            // const decodedEmail = req.decoded.email;
            // const query = { email: decodedEmail }
            // const user = await usersCollections.findOne(query)
            // if (user?.role !== 'admin') {
            //     return res.status(403).send({ message: 'forbidden access' })
            // }


            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const option = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollections.updateOne(filter, updatedDoc, option);
            res.send(result);
        })

        //temporary to update price field on appointment options
        //new data add hoye gele comment or delete korte hobe na hole bar bar add hobe.
        /*
        app.get('/addPrice', async (req, res) => {
            const filter = {}
            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    price: 90
                }
            }
            const result = await appointmentListOptionsCollection.updateMany(filter, updatedDoc, options)
            res.send(result)
        })
        */


        app.get('/appointmentSpecialty', async (req, res) => {
            const query = {};
            const result = await appointmentListOptionsCollection.find(query).project({ name: 1 }).toArray();
            res.send(result)
        })

        //DOctors
        app.post('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorsCollections.insertOne(doctor);
            res.send(result);
        })

        app.get('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
            const query = {}
            const result = await doctorsCollections.find(query).toArray();
            res.send(result);
        })

        app.delete('/doctors/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await doctorsCollections.deleteOne(filter);
            res.send(result);
        })



        //payment part---------------------
        app.post("/create-payment-intent", async (req, res) => {
            const booking = req.body
            const price = booking.price
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: "usd",
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })


        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.bookingId
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedResult = await bookingCollections.updateOne(filter, updatedDoc)
            res.send(result);
        })



        /**
         * simple convention for booking api
         * app.get('booking)
         * app.get('booking/:id')
         * app.post('booking')
         * app.patch('booking/:id')
         * app.delete('booking/:id')
         */
    }
    finally {

    }
}

run();



//------------------------------------------------------------------------
app.get('/', async (req, res) => {
    res.send('Doctor Portal server Is Running')
})

app.listen(port, () => {
    console.log(`Doctor portal server running on port ${port}`)
})