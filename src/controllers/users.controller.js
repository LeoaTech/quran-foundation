const service = require('../services/users.service');
const { uploadImage } = require('../services/cloudinary.service');

async function listUsers(req, res, next) {
  try {
    res.json(await service.listUsers({ user: req.user, query: req.query }));
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  try {
    res.json(await service.getUser({ user: req.user, userId: req.params.user_id }));
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    res.status(201).json(await service.createUser({ user: req.user, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    res.json(await service.updateUser({ user: req.user, userId: req.params.user_id, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function assignRole(req, res, next) {
  try {
    res.status(201).json(await service.assignRole({ user: req.user, userId: req.params.user_id, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function removeRole(req, res, next) {
  try {
    await service.removeRole({ user: req.user, userId: req.params.user_id, userRoleId: req.params.role_id });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function removeUserFromCenter(req, res, next) {
  try {
    await service.removeUserFromCenter({ user: req.user, userId: req.params.user_id, centerId: req.params.center_id });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function linkGuardian(req, res, next) {
  try {
    res.status(201).json(await service.linkGuardian({ user: req.user, userId: req.params.user_id, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function listGuardians(req, res, next) {
  try {
    res.json(await service.listGuardians({ user: req.user, userId: req.params.user_id }));
  } catch (err) {
    next(err);
  }
}

async function updateStaffProfile(req, res, next) {
  try {
    res.json(await service.updateStaffProfile({ 
      user: req.user, 
      userId: req.params.user_id, 
      oldCenterId: req.params.center_id,
      body: req.body 
    }));
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const body = { ...req.body };
    
    if (req.file) {
      const profilePictureUrl = await uploadImage(req.file.buffer, 'profiles');
      if (profilePictureUrl) {
        body.profile_picture = profilePictureUrl;
      }
    }

    res.json(await service.updateProfile({ user: req.user, userId: req.params.user_id, body }));
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    await service.changePassword({ user: req.user, userId: req.params.user_id, body: req.body });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
}

async function regeneratePassword(req, res, next) {
  try {
    const result = await service.regeneratePassword({ user: req.user, userId: req.params.user_id });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  updateStaffProfile,
  assignRole,
  removeRole,
  linkGuardian,
  listGuardians,
  removeUserFromCenter,
  updateProfile,
  changePassword,
  regeneratePassword,
};
