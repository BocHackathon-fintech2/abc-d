#!/bin/bash


carRecognized="FALSE"
previousPlate="0"

while [ $carRecognized = "FALSE" ]
do

	echo ""
	echo "TAKING IMAGE..."
	$(streamer -f jpeg -o image.jpeg) >/dev/null 2>&1
	echo ""
	echo "IMAGE TAKEN"

	sleep 0.4

	echo "PLATE RECOGNITION..."
	plate=$(curl -s -X POST -F image=@./image.jpeg 'https://api.openalpr.com/v2/recognize?recognize_vehicle=1&country=eu&secret_key=sk_DEMODEMODEMODEMODEMODEMO' | jq -r '.results[0].plate')
	
	#echo ${#plate} 

	if [[ ${#plate} -eq 6 ]]; then
		echo "VALIDATING...$plate"
		sleep 0.4
		if [ $previousPlate = $plate ]; then
			echo "PLATE FOUND!"
			echo "$plate"
			carRecognized="TRUE"

			echo "SENDING PLATE TO DATABASE..."
			response=$(curl https://us-central1-chatbank-a2cdf.cloudfunctions.net/readPlates?plate=$plate)
			echo "$response"

		fi
	else
		echo "NO PLATE"
	fi

	previousPlate=$plate

done




echo "EXITING..."

 


