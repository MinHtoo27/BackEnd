const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors'); // Add this line

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.json()); // Fixed the typo here


const MONGO_URI = 'mongodb+srv://Minhtoo27:Mhkmhk200327@minhtoo.ez3z0.mongodb.net/';
const client = new MongoClient(MONGO_URI, { useUnifiedTopology: true });

let lessonsCollection;
let ordersCollection;


async function connectToDatabase() {
    try {
        await client.connect();
        const db = client.db('Courses'); 
        lessonsCollection = db.collection('lessons'); 
        ordersCollection = db.collection('orders');
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error("Failed to connect to MongoDB:", error);
        process.exit(1);
    }
}

connectToDatabase();


app.get('/api/lessons', async (req, res) => {
    try {
        const lessons = await lessonsCollection.find({}).toArray();
        res.status(200).json(lessons);
    } catch (error) {
        console.error("Error fetching lessons:", error);
        res.status(500).json({ error: 'Failed to fetch lessons' });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const orders = await ordersCollection.find({}).toArray();
        res.status(200).json(orders);
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});



app.post('/api/orders', async (req, res) => {
    const { customerName, lessons } = req.body;
    
    if (!customerName || !lessons || !Array.isArray(lessons)) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        
        for (let lesson of lessons) {
            const foundLesson = await lessonsCollection.findOne({
                _id: new ObjectId(lesson.lessonId),
                spaces: { $gte: lesson.quantity },
            });

            if (!foundLesson) {
                return res.status(400).json({ 
                    error: `Lesson ${lesson.lessonId} not found or insufficient spaces` 
                });
            }
        }

        
        const newOrder = {
            customerName,
            lessons: lessons.map(lesson => ({
                lessonId: new ObjectId(lesson.lessonId),
                quantity: lesson.quantity
            })),
            orderDate: new Date(),
        };

        const result = await ordersCollection.insertOne(newOrder);

        // Update spaces for each lesson
        for (let lesson of lessons) {
            await lessonsCollection.updateOne(
                { _id: new ObjectId(lesson.lessonId) },
                { $inc: { spaces: -lesson.quantity } }
            );
        }

        res.status(201).json({ 
            message: 'Order created successfully', 
            orderId: result.insertedId 
        });
    } catch (error) {
        console.error("Error in POST /api/orders:", error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});


// Add a lesson to the cart (reduce spaces)
app.post('/api/cart', async (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ error: 'Lesson ID is required' });
    }

    try {
        const lesson = await lessonsCollection.findOneAndUpdate(
            { _id: new ObjectId(id), spaces: { $gt: 0 } },
            { $inc: { spaces: -1 } },
            { returnDocument: 'after' }
        );
        if (lesson.value) {
            res.status(200).json(lesson.value);
        } else {
            res.status(400).json({ error: 'Lesson is full or not found' });
        }
    } catch (error) {
        console.error("Error updating lesson:", error);
        res.status(500).json({ error: 'Failed to update lesson' });
    }
});

// Restore lesson spaces
app.post('/api/cart/remove', async (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ error: 'Lesson ID is required' });
    }

    try {
        const lesson = await lessonsCollection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $inc: { spaces: 1 } },
            { returnDocument: 'after' }
        );
        if (lesson.value) {
            res.status(200).json(lesson.value);
        } else {
            res.status(400).json({ error: 'Lesson not found' });
        }
    } catch (error) {
        console.error("Error restoring lesson spaces:", error);
        res.status(500).json({ error: 'Failed to restore lesson' });
    }
});

// Handle unknown routes
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});


const PORT = 3000; // You can change this port number if required
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

process.on('SIGINT', async () => {
    console.log("Shutting down gracefully...");
    await client.close();
    process.exit(0);
});
