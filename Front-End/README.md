Guide :
This extension allows the viewer to vote for a body part of the doll by selecting it directly on the 3D model and confirming his choice with the button below.
It provides several feedback for the user all along the usage of the extension (highlight of body parts, appearance of a pin on the voted part, reminder text below the button, etc..) and go trhough different phases, all shown in the testing environment that is setup for the review.

The testing environment is as follows (the times are approximate) :
- 10 sec in the tutorial phase
- 30 -35 sec in the vote phase
- 10 sec in the "pinned" phase, where the extension is frozen
- 30 sec in a new vote phase
And then it goes back to the tutorial phase, in an infinite loop, so that you can test every part of the extension.

Changelog : 

1.0.0 (actual) :
Minor bug fixes

0.0.3 :
Design rework
3D model rework
Custom PubSub messages implemented
Sync system between the game status registered on the EBS and the extenson status
User feedback improved
Minor bug fixes

0.0.2 :
Skybox added
Mobile support added
Minor bug fixes

0.0.1 :
Extension basic vote system added
3D model added