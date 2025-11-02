import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all bottle categories
export const getAllBottleCategories = async (req, res) => {
  try {
    const categories = await prisma.bottleCategory.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching bottle categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bottle categories',
      error: error.message
    });
  }
};

// Get bottle category by ID
export const getBottleCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await prisma.bottleCategory.findUnique({
      where: { id }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Bottle category not found'
      });
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error fetching bottle category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bottle category',
      error: error.message
    });
  }
};

// Create bottle category
export const createBottleCategory = async (req, res) => {
  try {
    const { categoryName, price } = req.body;

    // Validate required fields
    if (!categoryName || price === undefined || price === null) {
      return res.status(400).json({
        success: false,
        message: 'Category name and price are required'
      });
    }

    // Check if company setup exists
    const companySetup = await prisma.companySetup.findFirst();
    if (!companySetup) {
      return res.status(404).json({
        success: false,
        message: 'Company setup not found. Please create company setup first.'
      });
    }

    // Create bottle category
    const category = await prisma.bottleCategory.create({
      data: {
        categoryName,
        price: parseFloat(price),
        companySetupId: companySetup.id
      }
    });

    res.status(201).json({
      success: true,
      message: 'Bottle category created successfully',
      data: category
    });
  } catch (error) {
    console.error('Error creating bottle category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create bottle category',
      error: error.message
    });
  }
};

// Update bottle category
export const updateBottleCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryName, price } = req.body;

    // Validate required fields
    if (!categoryName || price === undefined || price === null) {
      return res.status(400).json({
        success: false,
        message: 'Category name and price are required'
      });
    }

    // Check if category exists
    const existing = await prisma.bottleCategory.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Bottle category not found'
      });
    }

    // Update category
    const category = await prisma.bottleCategory.update({
      where: { id },
      data: {
        categoryName,
        price: parseFloat(price)
      }
    });

    res.json({
      success: true,
      message: 'Bottle category updated successfully',
      data: category
    });
  } catch (error) {
    console.error('Error updating bottle category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bottle category',
      error: error.message
    });
  }
};

// Delete bottle category
export const deleteBottleCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category exists
    const existing = await prisma.bottleCategory.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Bottle category not found'
      });
    }

    // Delete category
    await prisma.bottleCategory.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Bottle category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting bottle category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete bottle category',
      error: error.message
    });
  }
};

