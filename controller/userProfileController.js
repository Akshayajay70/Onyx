import userSchema from "../model/userModel.js";

const getProfile = async (req, res) => {
    try {
        const user = await userSchema.findById(req.session.user);
        res.render('user/profile', { user });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).send('Error loading profile');
    }
};

const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, email} = req.body;
    
    // Update user profile
    await userSchema.findOneAndUpdate( {email:email} , {
      firstName,
      lastName,
    },
    {new:true});

    res.redirect('/profile')
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
};

export default { getProfile, updateProfile }