const mongoose = require('mongoose');
const QuickLink = require('../models/QuickLink');

function isValidHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const listQuickLinks = async (req, res) => {
  try {
    const audience = String(req.query.audience || 'student');
    const allowed = new Set(['student', 'admin', 'both']);
    const normalized = allowed.has(audience) ? audience : 'student';

    const docs = await QuickLink.find({
      audience: normalized === 'both' ? 'both' : { $in: [normalized, 'both'] },
    })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json(
      docs.map((d) => ({
        id: String(d._id),
        name: d.name,
        href: d.href,
        audience: d.audience,
      }))
    );
  } catch (error) {
    console.error('🔥 Error listing quick links:', error);
    return res.status(500).json({ message: 'Server error while listing quick links' });
  }
};

const createQuickLink = async (req, res) => {
  try {
    const { name, href, audience } = req.body || {};

    if (!name || !href) {
      return res.status(400).json({ message: 'name and href are required' });
    }

    const trimmedName = String(name).trim();
    const trimmedHref = String(href).trim();

    if (!trimmedName) {
      return res.status(400).json({ message: 'name is required' });
    }

    if (!isValidHttpUrl(trimmedHref)) {
      return res.status(400).json({ message: 'href must be a valid http(s) URL' });
    }

    const allowedAudiences = new Set(['student', 'admin', 'both']);
    const normalizedAudience = allowedAudiences.has(String(audience)) ? String(audience) : 'student';

    const created = await QuickLink.create({
      name: trimmedName,
      href: trimmedHref,
      audience: normalizedAudience,
      createdBy: req.user?._id,
    });

    return res.status(201).json({
      id: String(created._id),
      name: created.name,
      href: created.href,
      audience: created.audience,
    });
  } catch (error) {
    console.error('🔥 Error creating quick link:', error);
    return res.status(500).json({ message: 'Server error while creating quick link' });
  }
};

const deleteQuickLink = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid quick link id' });
    }

    const deleted = await QuickLink.findByIdAndDelete(id).lean();
    if (!deleted) {
      return res.status(404).json({ message: 'Quick link not found' });
    }

    return res.status(200).json({ message: 'Quick link deleted' });
  } catch (error) {
    console.error('🔥 Error deleting quick link:', error);
    return res.status(500).json({ message: 'Server error while deleting quick link' });
  }
};

module.exports = {
  listQuickLinks,
  createQuickLink,
  deleteQuickLink,
};
