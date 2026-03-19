var express = require('express');
var router = express.Router();

let mongoose = require('mongoose');
let inventoryModel = require('../schemas/inventories');
let productModel = require('../schemas/products');

function parseQuantity(req, res) {
    let product = req.body.product;
    let quantity = req.body.quantity;

    if (!product || !mongoose.Types.ObjectId.isValid(product)) {
        res.status(400).send({ message: 'product phai la mongo id' });
        return null;
    }
    let qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
        res.status(400).send({ message: 'quantity phai la so nguyen duong' });
        return null;
    }

    return { product, qty };
}

async function ensureProductExists(productId) {
    return await productModel.findOne({ _id: productId, isDeleted: false });
}

async function ensureInventory(productId) {
    await inventoryModel.updateOne(
        { product: productId },
        {
            $setOnInsert: {
                product: productId,
                stock: 0,
                reserved: 0,
                soldCount: 0
            }
        },
        { upsert: true }
    );
}

router.get('/', async function (req, res) {
    let data = await inventoryModel.find().populate({ path: 'product' });
    res.send(data);
});

router.post('/add-stock', async function (req, res) {
    try {
        let parsed = parseQuantity(req, res);
        if (!parsed) return;

        let existedProduct = await ensureProductExists(parsed.product);
        if (!existedProduct) return res.status(404).send({ message: 'PRODUCT NOT FOUND' });

        await ensureInventory(parsed.product);
        let updated = await inventoryModel.findOneAndUpdate(
            { product: parsed.product },
            { $inc: { stock: parsed.qty } },
            { new: true }
        );
        res.send(updated);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

router.post('/remove-stock', async function (req, res) {
    try {
        let parsed = parseQuantity(req, res);
        if (!parsed) return;

        let existedProduct = await ensureProductExists(parsed.product);
        if (!existedProduct) return res.status(404).send({ message: 'PRODUCT NOT FOUND' });

        await ensureInventory(parsed.product);
        let updated = await inventoryModel.findOneAndUpdate(
            { product: parsed.product, stock: { $gte: parsed.qty } },
            { $inc: { stock: -parsed.qty } },
            { new: true }
        );
        if (!updated) {
            return res.status(400).send({ message: 'STOCK NOT ENOUGH' });
        }
        res.send(updated);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

router.post('/reservation', async function (req, res) {
    try {
        let parsed = parseQuantity(req, res);
        if (!parsed) return;

        let existedProduct = await ensureProductExists(parsed.product);
        if (!existedProduct) return res.status(404).send({ message: 'PRODUCT NOT FOUND' });

        await ensureInventory(parsed.product);
        let updated = await inventoryModel.findOneAndUpdate(
            { product: parsed.product, stock: { $gte: parsed.qty } },
            { $inc: { stock: -parsed.qty, reserved: parsed.qty } },
            { new: true }
        );
        if (!updated) {
            return res.status(400).send({ message: 'STOCK NOT ENOUGH' });
        }
        res.send(updated);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

router.post('/sold', async function (req, res) {
    try {
        let parsed = parseQuantity(req, res);
        if (!parsed) return;

        let existedProduct = await ensureProductExists(parsed.product);
        if (!existedProduct) return res.status(404).send({ message: 'PRODUCT NOT FOUND' });

        await ensureInventory(parsed.product);
        let updated = await inventoryModel.findOneAndUpdate(
            { product: parsed.product, reserved: { $gte: parsed.qty } },
            { $inc: { reserved: -parsed.qty, soldCount: parsed.qty } },
            { new: true }
        );
        if (!updated) {
            return res.status(400).send({ message: 'RESERVED NOT ENOUGH' });
        }
        res.send(updated);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

router.get('/:id', async function (req, res) {
    try {
        let id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).send({ message: 'ID INVALID' });
        }
        let result = await inventoryModel.findById(id).populate({ path: 'product' });
        if (result) {
            res.send(result);
        } else {
            res.status(404).send({ message: 'ID NOT FOUND' });
        }
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

module.exports = router;

