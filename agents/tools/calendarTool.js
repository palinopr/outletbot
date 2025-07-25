const { GHLService } = require('../../services/ghlService');

// Tool for checking calendar availability
async function checkCalendarAvailability({ ghlService, calendarId, dateRange = 7 }) {
  try {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + dateRange);
    
    const slots = await ghlService.getAvailableSlots(
      calendarId,
      startDate.toISOString(),
      endDate.toISOString()
    );
    
    // Format slots for easy display
    const formattedSlots = slots.slice(0, 5).map(slot => {
      const date = new Date(slot.startTime);
      return {
        display: date.toLocaleString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }),
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotId: slot.id
      };
    });
    
    return {
      success: true,
      availableSlots: formattedSlots,
      totalAvailable: slots.length
    };
  } catch (error) {
    console.error('Calendar check error:', error);
    return {
      success: false,
      error: error.message,
      availableSlots: []
    };
  }
}

// Tool for booking appointment
async function bookAppointment({ 
  ghlService, 
  calendarId, 
  contactId, 
  selectedSlot,
  appointmentTitle = "Sales Consultation"
}) {
  try {
    const appointment = await ghlService.bookAppointment(
      calendarId,
      contactId,
      {
        title: appointmentTitle,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        appointmentStatus: 'confirmed'
      }
    );
    
    return {
      success: true,
      appointment: {
        id: appointment.id,
        title: appointment.title,
        startTime: appointment.startTime,
        status: appointment.appointmentStatus
      }
    };
  } catch (error) {
    console.error('Booking error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Parse customer's time selection
function parseTimeSelection(customerInput, availableSlots) {
  const input = customerInput.toLowerCase();
  
  // Check for specific mentions like "first", "second", "tomorrow at 10"
  for (let i = 0; i < availableSlots.length; i++) {
    const slot = availableSlots[i];
    const slotDisplay = slot.display.toLowerCase();
    
    // Check if customer mentioned specific time
    if (input.includes('10') && slotDisplay.includes('10:')) {
      return slot;
    }
    if (input.includes('2') && slotDisplay.includes('2:')) {
      return slot;
    }
    if (input.includes('11') && slotDisplay.includes('11:')) {
      return slot;
    }
    
    // Check for ordinal references
    if ((input.includes('first') || input.includes('1st')) && i === 0) {
      return slot;
    }
    if ((input.includes('second') || input.includes('2nd')) && i === 1) {
      return slot;
    }
    if ((input.includes('third') || input.includes('3rd')) && i === 2) {
      return slot;
    }
    
    // Check for day mentions
    const slotDay = slotDisplay.split(',')[0];
    if (input.includes(slotDay)) {
      return slot;
    }
  }
  
  // Default to first slot if unclear
  return availableSlots[0];
}

module.exports = {
  checkCalendarAvailability,
  bookAppointment,
  parseTimeSelection
};