import mongoose from "mongoose";
import User from "../models/UserModel.js";
import Message from "../models/MessagesModel.js";

// Controller to search for contacts based on a search term
export const searchContacts = async (req, res, next) => {
  try {
    const { searchTerm } = req.body;

    // Validate that the search term is provided
    if (searchTerm === undefined || searchTerm === null) {
      return res.status(400).send("Search Term is required.");
    }

    // Sanitize the search term by escaping special characters used in regular expressions
    const sanitizedSearchTerm = searchTerm.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    // Create a new regular expression using the sanitized search term, case-insensitive
    const regex = new RegExp(sanitizedSearchTerm, "i");

    // Find contacts in the database that match the search criteria
    const contacts = await User.find({
      $and: [
        { _id: { $ne: req.userId } }, // Exclude the requesting user's ID
        {
          $or: [
            { firstName: regex }, // Match first name against the regex
            { lastName: regex }, // Match last name against the regex
            { email: regex }, // Match email against the regex
          ],
        },
      ],
    });

    // Return the matched contacts
    return res.status(200).json({ contacts });
  } catch (error) {
    console.log({ error });
    return res.status(500).send("Internal Server Error.");
  }
};

// Controller to get a list of contacts for the direct messages (DM) list
export const getContactsForDMList = async (req, res, next) => {
  try {
    // Convert the userId to a mongoose ObjectId
    let { userId } = req;
    userId = new mongoose.Types.ObjectId(userId);

    // Aggregate messages to find contacts for the DM list
    const contacts = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { recipient: userId }], // Match messages where the user is either the sender or the recipient
        },
      },
      {
        $sort: { timestamp: -1 }, // Sort messages by timestamp in descending order
      },
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ["$sender", userId] },
              then: "$recipient", // Group by recipient if the user is the sender
              else: "$sender", // Group by sender if the user is the recipient
            },
          },
          lastMessageTime: { $first: "$timestamp" }, // Get the timestamp of the last message
        },
      },
      {
        $lookup: {
          from: "users", // Lookup the user information from the users collection
          localField: "_id",
          foreignField: "_id",
          as: "contactInfo",
        },
      },
      {
        $unwind: "$contactInfo", // Unwind the contact information array
      },
      {
        $project: {
          _id: 1,
          lastMessageTime: 1,
          email: "$contactInfo.email", // Include the contact's email
          firstName: "$contactInfo.firstName", // Include the contact's first name
          lastName: "$contactInfo.lastName", // Include the contact's last name
          image: "$contactInfo.image", // Include the contact's profile image
          color: "$contactInfo.color", // Include the contact's profile color
        },
      },
      {
        $sort: { lastMessageTime: -1 }, // Sort the contacts by the last message time in descending order
      },
    ]);

    // Return the list of contacts for the DM list
    return res.status(200).json({ contacts });
  } catch (error) {
    console.log({ error });
    return res.status(500).send("Internal Server Error.");
  }
};

export const getAllContacts = async (req, res, next) => {
  try {
    const users = await User.find({_id: {$ne:req.userId}}, "firstName lastName _id email");

    const contacts = users.map((user)=>({
      label: user.firstName ? `${user.firstName} ${user.lastName}` : user.email,
      value: user._id,
    }))
    
    return res.status(200).json({ contacts });
  } catch (error) {
    console.log({ error });
    return res.status(500).send("Internal Server Error.");
  }
};