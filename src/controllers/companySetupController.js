import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get company setup (only one record)
export const getCompanySetup = async (req, res) => {
  try {
    const companySetup = await prisma.companySetup.findFirst({
      include: {
        bottleCategories: {
          orderBy: { createdAt: 'asc' }
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
      data: companySetup,
      message: 'Company setup retrieved successfully'
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
    const { agencyName, agencyAddress, agencyPhoneNumber, agencyLogo, areasOperated } = req.body;

    // Validate required fields
    if (!agencyName || !agencyAddress || !agencyPhoneNumber || !agencyLogo) {
      return res.status(400).json({
        success: false,
        message: 'Agency name, address, phone number, and logo are required'
      });
    }

    // Check if company setup already exists
    const existingSetup = await prisma.companySetup.findFirst();
    if (existingSetup) {
      return res.status(400).json({
        success: false,
        message: 'Company setup already exists. Use update endpoint instead.'
      });
    }

    // Create company setup
    const companySetup = await prisma.companySetup.create({
      data: {
        agencyName,
        agencyAddress,
        agencyPhoneNumber,
        agencyLogo,
        areasOperated: areasOperated || []
      },
      include: {
        bottleCategories: true
      }
    });

    res.status(201).json({
      success: true,
      data: companySetup,
      message: 'Company setup created successfully'
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
    const { id } = req.params;
    const { agencyName, agencyAddress, agencyPhoneNumber, agencyLogo, areasOperated } = req.body;

    // Check if company setup exists
    const existingSetup = await prisma.companySetup.findUnique({
      where: { id }
    });

    if (!existingSetup) {
      return res.status(404).json({
        success: false,
        message: 'Company setup not found'
      });
    }

    // Update company setup
    const updatedSetup = await prisma.companySetup.update({
      where: { id },
      data: {
        ...(agencyName && { agencyName }),
        ...(agencyAddress && { agencyAddress }),
        ...(agencyPhoneNumber && { agencyPhoneNumber }),
        ...(agencyLogo && { agencyLogo }),
        ...(areasOperated !== undefined && { areasOperated })
      },
      include: {
        bottleCategories: true
      }
    });

    res.json({
      success: true,
      data: updatedSetup,
      message: 'Company setup updated successfully'
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

// Delete company setup (not recommended but included for completeness)
export const deleteCompanySetup = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if company setup exists
    const existingSetup = await prisma.companySetup.findUnique({
      where: { id }
    });

    if (!existingSetup) {
      return res.status(404).json({
        success: false,
        message: 'Company setup not found'
      });
    }

    // Delete company setup (will cascade delete bottle categories)
    await prisma.companySetup.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Company setup deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting company setup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete company setup',
      error: error.message
    });
  }
};

