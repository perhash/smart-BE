import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all bottle categories
export const getAllBottleCategories = async (req, res) => {
  try {
    const bottleCategories = await prisma.bottleCategory.findMany({
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      success: true,
      data: bottleCategories,
      message: 'Bottle categories retrieved successfully'
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

    const bottleCategory = await prisma.bottleCategory.findUnique({
      where: { id },
      include: {
        companySetup: true
      }
    });

    if (!bottleCategory) {
      return res.status(404).json({
        success: false,
        message: 'Bottle category not found'
      });
    }

    res.json({
      success: true,
      data: bottleCategory,
      message: 'Bottle category retrieved successfully'
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
    const { categoryName, price, companySetupId } = req.body;

    // Validate required fields
    if (!categoryName || !price) {
      return res.status(400).json({
        success: false,
        message: 'Category name and price are required'
      });
    }

    // If companySetupId not provided, get the first one
    let setupId = companySetupId;
    if (!setupId) {
      const companySetup = await prisma.companySetup.findFirst();
      if (!companySetup) {
        return res.status(400).json({
          success: false,
          message: 'No company setup found. Please create company setup first.'
        });
      }
      setupId = companySetup.id;
    }

    // Create bottle category
    const bottleCategory = await prisma.bottleCategory.create({
      data: {
        categoryName,
        price: parseFloat(price),
        companySetupId: setupId
      }
    });

    res.status(201).json({
      success: true,
      data: bottleCategory,
      message: 'Bottle category created successfully'
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

    // Check if bottle category exists
    const existingCategory = await prisma.bottleCategory.findUnique({
      where: { id }
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: 'Bottle category not found'
      });
    }

    // Update bottle category
    const updatedCategory = await prisma.bottleCategory.update({
      where: { id },
      data: {
        ...(categoryName && { categoryName }),
        ...(price !== undefined && { price: parseFloat(price) })
      }
    });

    res.json({
      success: true,
      data: updatedCategory,
      message: 'Bottle category updated successfully'
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

    // Check if bottle category exists
    const existingCategory = await prisma.bottleCategory.findUnique({
      where: { id }
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: 'Bottle category not found'
      });
    }

    // Delete bottle category
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

// Bulk create bottle categories
export const bulkCreateBottleCategories = async (req, res) => {
  try {
    const { categories } = req.body; // Array of { categoryName, price }

    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Categories array is required and cannot be empty'
      });
    }

    // Get company setup
    const companySetup = await prisma.companySetup.findFirst();
    if (!companySetup) {
      return res.status(400).json({
        success: false,
        message: 'No company setup found. Please create company setup first.'
      });
    }

    // Validate all categories
    for (const category of categories) {
      if (!category.categoryName || !category.price) {
        return res.status(400).json({
          success: false,
          message: 'Each category must have categoryName and price'
        });
      }
    }

    // Create all bottle categories
    const createdCategories = await prisma.$transaction(
      categories.map(category =>
        prisma.bottleCategory.create({
          data: {
            categoryName: category.categoryName,
            price: parseFloat(category.price),
            companySetupId: companySetup.id
          }
        })
      )
    );

    res.status(201).json({
      success: true,
      data: createdCategories,
      message: 'Bottle categories created successfully'
    });
  } catch (error) {
    console.error('Error bulk creating bottle categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create bottle categories',
      error: error.message
    });
  }
};

