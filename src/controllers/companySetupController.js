import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get company setup (only one should exist)
export const getCompanySetup = async (req, res) => {
  try {
    const companySetup = await prisma.companySetup.findFirst({
      include: {
        bottleCategories: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!companySetup) {
      return res.json({
        success: true,
        data: null,
        message: 'No company setup found'
      });
    }

    res.json({
      success: true,
      data: companySetup
    });
  } catch (error) {
    console.error('Error fetching company setup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company setup',
      error: error.message
    });
  }
};

// Create company setup
export const createCompanySetup = async (req, res) => {
  try {
    const { agencyName, agencyAddress, agencyPhoneNumber, agencyLogo, areasOperated, bottleCategories } = req.body;

    // Validate required fields
    if (!agencyName || !agencyAddress || !agencyPhoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Agency name, address, and phone number are required'
      });
    }

    // Check if company setup already exists
    const existing = await prisma.companySetup.findFirst();
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Company setup already exists. Use PUT endpoint to update.'
      });
    }

    // Create company setup with optional bottle categories
    const companySetup = await prisma.companySetup.create({
      data: {
        agencyName,
        agencyAddress,
        agencyPhoneNumber,
        agencyLogo: agencyLogo || '',
        areasOperated: areasOperated || [],
        ...(bottleCategories && bottleCategories.length > 0 && {
          bottleCategories: {
            create: bottleCategories.map(cat => ({
              categoryName: cat.categoryName,
              price: parseFloat(cat.price)
            }))
          }
        })
      },
      include: {
        bottleCategories: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Company setup created successfully',
      data: companySetup
    });
  } catch (error) {
    console.error('Error creating company setup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create company setup',
      error: error.message
    });
  }
};

// Update company setup
export const updateCompanySetup = async (req, res) => {
  try {
    const { agencyName, agencyAddress, agencyPhoneNumber, agencyLogo, areasOperated } = req.body;

    // Validate required fields
    if (!agencyName || !agencyAddress || !agencyPhoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Agency name, address, and phone number are required'
      });
    }

    // Find existing company setup
    const existing = await prisma.companySetup.findFirst();
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Company setup not found. Use POST endpoint to create.'
      });
    }

    // Update company setup
    const companySetup = await prisma.companySetup.update({
      where: { id: existing.id },
      data: {
        agencyName,
        agencyAddress,
        agencyPhoneNumber,
        agencyLogo: agencyLogo !== undefined ? agencyLogo : existing.agencyLogo,
        areasOperated: areasOperated || existing.areasOperated
      }
    });

    res.json({
      success: true,
      message: 'Company setup updated successfully',
      data: companySetup
    });
  } catch (error) {
    console.error('Error updating company setup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update company setup',
      error: error.message
    });
  }
};

